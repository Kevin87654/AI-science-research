import "server-only";

/**
 * CodeBuddy Agent SDK 适配器（B 负责）。
 *
 * 三条纪律：
 *
 * 1. **只做文本问答，不给任何工具。** 我们只需要模型"读一段 JSON、写一段 JSON"，
 *    所以显式传 `allowedTools: []` 并限制 `maxTurns: 1` —— 分析用户作答不需要读写文件。
 * 2. **必须有超时。** SDK 是 spawn 一个 CLI 子进程，local 实测约 2.4 秒、Vercel 上
 *    约 7.4 秒（含冷启动）；一旦上游卡住，用户会对着转圈等到崩溃。超时即中断并降级。
 * 3. **密钥只进环境变量，绝不进日志、错误信息或返回值。**
 *
 * Vercel 上的两个必要配置来自探针结论（`agent-vercel-probe`）：
 * `serverExternalPackages` + `outputFileTracingIncludes`（见 `next.config.ts`），
 * 以及把 `HOME` / `TMPDIR` / `XDG_CONFIG_HOME` 指到可写的 `/tmp` —— Vercel 的 home 目录不存在。
 */
import { query } from "@tencent-ai/agent-sdk";

import { buildCodebuddyEnv, isAiConfigured, resolveAiTimeoutMs } from "./config";

export type AiFailureCode = "not_configured" | "timeout" | "empty" | "busy" | "failed";

export type AiTextResult =
  | { ok: true; text: string; durationMs: number }
  | { ok: false; code: AiFailureCode; message: string };

export { isAiConfigured };

type StreamMessage = {
  type?: string;
  subtype?: string;
  message?: { content?: unknown };
};

/** 从 assistant 消息里取出文本块；结构按 SDK 文档，但用运行时判断而非强转类型。 */
function extractText(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];

  const texts: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string" && candidate.text.length > 0) {
      texts.push(candidate.text);
    }
  }
  return texts;
}

/**
 * 同时在跑的模型调用数上限。
 *
 * 每次调用都会 spawn 一个 CLI 子进程，很重。用户连点、或一次测评里几道题同时要决策时，
 * 多个调用叠在一起会把机器拖慢（实测出现过服务整体失去响应）。超过上限就直接用规则出题 ——
 * 快一点、但结果依然成立，总比整站卡住好。
 *
 * ⚠️ 这是**进程内**计数：Serverless 上每个实例各算各的，只能挡住单实例内的堆积。
 */
const MAX_CONCURRENT_CALLS = 2;
let inFlightCalls = 0;

/** 真正发起调用并收集文本。失败信息只记类型，不记 error 本体（可能带请求上下文）。 */
async function collectText(
  prompt: string,
  abortController: AbortController,
  startedAt: number,
): Promise<AiTextResult> {
  try {
    const conversation = query({
      prompt,
      options: {
        env: buildCodebuddyEnv(),
        // 纯文本任务：不开放任何工具，也不给它多轮循环的机会。
        allowedTools: [],
        maxTurns: 1,
        abortController,
      },
    });

    const chunks: string[] = [];

    for await (const raw of conversation as AsyncIterable<unknown>) {
      const message = raw as StreamMessage;
      if (message.type === "assistant") {
        chunks.push(...extractText(message.message?.content));
      }
    }

    const text = chunks.join("").trim();
    if (text.length === 0) {
      // 单独一种失败码：这不是"调用报错"，而是"被超时截断"或"模型没输出文本"。
      // 之前把它和普通失败混在一起，排查时看不出真正原因。
      console.error(`[ai] 未取到文本 aborted=${String(abortController.signal.aborted)} 耗时=${Date.now() - startedAt}ms`);
      return abortController.signal.aborted
        ? { ok: false, code: "timeout", message: "模型响应超时" }
        : { ok: false, code: "empty", message: "模型没有返回可用的文本" };
    }

    return { ok: true, text, durationMs: Date.now() - startedAt };
  } catch (error) {
    const aborted = abortController.signal.aborted;
    // 默认只记录错误类型，不记录 error 本体。排查线上问题时设 SERVER_AI_DEBUG=1 打开详情。
    const name = error instanceof Error ? error.name : typeof error;
    const detail =
      process.env.SERVER_AI_DEBUG === "1" && error instanceof Error
        ? ` message=${JSON.stringify(error.message.slice(0, 300))}`
        : "";
    console.error(`[ai] 调用失败 aborted=${String(aborted)} name=${name}${detail}`);

    return aborted
      ? { ok: false, code: "timeout", message: "模型响应超时" }
      : { ok: false, code: "failed", message: "模型调用失败" };
  }
}

export async function askText(prompt: string, options: { timeoutMs?: number } = {}): Promise<AiTextResult> {
  if (!isAiConfigured()) {
    return { ok: false, code: "not_configured", message: "未配置 AI 密钥" };
  }

  if (inFlightCalls >= MAX_CONCURRENT_CALLS) {
    console.error(`[ai] 同时进行的调用已达上限 ${MAX_CONCURRENT_CALLS}，本次直接用规则出题`);
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
      console.error(`[ai] 超过 ${timeoutMs}ms 仍未返回，放弃本次调用（不等 SDK 收尾）`);
      resolve({ ok: false, code: "timeout", message: "模型响应超时" });
    }, timeoutMs);
  });

  try {
    // ⚠️ 这里必须用 Promise.race，而不是"只让定时器去 abort"。
    // 实测发现：`abortController.abort()` **不保证** SDK 的异步迭代会结束 ——
    // 一旦它继续挂着，这个 HTTP 请求就永远不返回，表现为**整个服务卡死**
    // （连 /api/ping 都超时，因为请求一直占着不放）。
    // 用 race 之后，无论 SDK 行为如何，本函数都在 timeoutMs 内返回；
    // 挂着的那个 CLI 子进程交给系统回收，宁可浪费一点资源也不能让站点失去响应。
    return await Promise.race([collectText(prompt, abortController, startedAt), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    inFlightCalls -= 1;
  }
}
