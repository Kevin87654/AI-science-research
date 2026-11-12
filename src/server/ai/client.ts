import "server-only";

/**
 * DeepSeek（OpenAI 兼容）直连适配器（B 负责）。
 *
 * 2026-11-12 替换原来的 `codebuddy.ts`：CodeBuddy 的 CLI 额度通道已不可用，
 * 改为直接 `POST {base}/chat/completions`。相比旧实现少了三件事：
 * 不再 spawn 子进程、不再有 13～15 秒固定启动开销、不再需要 SDK 的 CLI 路径配置。
 *
 * 四条纪律：
 *
 * 1. **只做文本问答，不给任何工具。** 这里只是一次 HTTP 请求，模型无法读写文件或执行命令。
 * 2. **必须有超时。** 上游卡住时用户会对着转圈等到崩溃；超时即中断并让调用方降级。
 * 3. **密钥只进环境变量，绝不进日志、错误信息或返回值。**
 * 4. **失败必须可降级。** 返回结构化失败码，调用方据此回落规则回答 / 规则提醒。
 */
import {
  isAiConfigured,
  resolveAiApiKey,
  resolveAiBaseUrl,
  resolveAiModel,
  resolveAiTimeoutMs,
} from "./config";

export type AiFailureCode = "not_configured" | "timeout" | "empty" | "busy" | "failed";

export type AiTextResult =
  | { ok: true; text: string; durationMs: number }
  | { ok: false; code: AiFailureCode; message: string };

export { isAiConfigured };

export interface AskTextOptions {
  timeoutMs?: number;
  /** 覆盖 `SERVER_AI_MODEL`；不传则用环境变量里的模型。 */
  model?: string;
  /** 要求模型返回一个 JSON 对象（OpenAI `response_format`）。 */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /**
   * DeepSeek 的推理强度。默认由模型决定（flash 默认 high）。
   * 提醒/汇总这类"读事实写一段话"的任务用 low 可以显著减少 reasoning token，
   * 避免正文被 max_tokens 截断（2026-11-12 实测：high + 1400 会截断，low + 2500 正常）。
   */
  reasoningEffort?: "low" | "high" | "max";
}

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: unknown };
};

/**
 * 同时在跑的调用数上限。
 *
 * 直连 HTTP 比旧 CLI 轻得多，但仍要挡住"用户连点 + 多个页面同时请求"造成的额度洪峰。
 * 超过上限直接返回 `busy`，让调用方走规则 —— 快一点、但结果依然成立。
 *
 * ⚠️ 这是**进程内**计数：Serverless 上每个实例各算各的。
 */
const MAX_CONCURRENT_CALLS = 4;
/**
 * 默认输出上限。**不是费用**，只是截断保护。
 *
 * DeepSeek 的 reasoning token 也计入 `max_tokens`：默认 high 推理时，
 * 1200 的上限可能在正文写一半就被截断（2026-11-12 实测汇总任务）。
 * 所以默认放宽到 3000；短任务仍按需传更小的值。
 */
const DEFAULT_MAX_TOKENS = 3000;

let inFlightCalls = 0;

/** 兼容两种返回：纯字符串，或 `[{type:"text",text:"..."}]` 的内容块数组。 */
function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    if (typeof part !== "object" || part === null) continue;
    const candidate = part as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") {
      parts.push(candidate.text);
    }
  }
  return parts.join("");
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * 真正发请求。失败信息只记状态码/错误类型，不记请求头（里面有密钥）。
 */
async function requestCompletion(
  prompt: string,
  options: AskTextOptions,
  signal: AbortSignal,
  startedAt: number,
): Promise<AiTextResult> {
  const model = options.model?.trim() || resolveAiModel();
  const body = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
    stream: false,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
    ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${resolveAiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resolveAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) return { ok: false, code: "timeout", message: "模型响应超时" };
    console.error(`[ai] 请求失败 name=${errorName(error)}`);
    return { ok: false, code: "failed", message: "模型调用失败" };
  }

  if (!response.ok) {
    // 错误体可能带请求上下文，只在调试开关打开时截断记录；密钥不在响应体里。
    if (process.env.SERVER_AI_DEBUG === "1") {
      const detail = await response.text().catch(() => "");
      console.error(`[ai] HTTP ${response.status} ${detail.slice(0, 400)}`);
    } else {
      console.error(`[ai] HTTP ${response.status}`);
    }
    return { ok: false, code: "failed", message: "模型调用失败" };
  }

  let payload: ChatCompletionPayload;
  try {
    payload = (await response.json()) as ChatCompletionPayload;
  } catch {
    console.error("[ai] 响应不是合法 JSON");
    return { ok: false, code: "failed", message: "模型返回了无法识别的内容" };
  }

  const text = extractContent(payload.choices?.[0]?.message?.content).trim();
  if (text.length === 0) {
    console.error(`[ai] 未取到文本 耗时=${Date.now() - startedAt}ms aborted=${String(signal.aborted)}`);
    return signal.aborted
      ? { ok: false, code: "timeout", message: "模型响应超时" }
      : { ok: false, code: "empty", message: "模型没有返回可用的文本" };
  }

  return { ok: true, text, durationMs: Date.now() - startedAt };
}

/**
 * 向模型要一段文本。
 *
 * `json: true` 时要求上游按 JSON 对象返回；**调用方仍必须自己校验结构** ——
 * `response_format` 只保证"像个 JSON"，不保证字段齐全、内容可信。
 */
export async function askText(prompt: string, options: AskTextOptions = {}): Promise<AiTextResult> {
  if (!isAiConfigured()) {
    return { ok: false, code: "not_configured", message: "未配置 AI 密钥" };
  }

  if (inFlightCalls >= MAX_CONCURRENT_CALLS) {
    console.error(`[ai] 同时进行的调用已达上限 ${MAX_CONCURRENT_CALLS}，本次走规则`);
    return { ok: false, code: "busy", message: "模型正忙" };
  }

  const timeoutMs = options.timeoutMs ?? resolveAiTimeoutMs();
  const startedAt = Date.now();
  const abortController = new AbortController();
  inFlightCalls += 1;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<AiTextResult>((resolve) => {
    timer = setTimeout(() => {
      abortController.abort();
      console.error(`[ai] 超过 ${timeoutMs}ms 仍未返回，放弃本次调用`);
      resolve({ ok: false, code: "timeout", message: "模型响应超时" });
    }, timeoutMs);
  });

  try {
    // 与旧适配器同样的理由：fetch 的 abort 不保证立刻结束，用 race 保证 HTTP 请求一定返回。
    return await Promise.race([requestCompletion(prompt, options, abortController.signal, startedAt), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    inFlightCalls -= 1;
  }
}
