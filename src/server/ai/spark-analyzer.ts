import "server-only";

/**
 * 「奇思妙想」分析（B 负责）—— 自由文本 → 亮点 + 兴趣方向。
 *
 * 只做一件事：组提示词 → 调模型 → 校验 → 返回 `SparkAnalysis` 或 `null`。
 * 结构合法性、方向 id 是否在固定目录内，全部由 `@/features/spark/analyze`
 * 的纯函数判定，这里不重复实现。
 *
 * 降级语义与问答一致：返回 `null` 表示"这次给不出可信结果"（没配密钥 / 超时 /
 * 并发超限 / 输出不合法），由调用方（API 层）决定怎么回应 —— 不把模型失败
 * 细节透给用户。
 */
import { randomUUID } from "node:crypto";

import type { SparkAnalysis } from "@/contracts";
import { INTEREST_DIRECTION_DESCRIPTIONS, INTEREST_DIRECTION_ORDER, INTEREST_DIRECTIONS } from "@/features/interest/directions";
import { parseSparkAnalysis } from "@/features/spark/analyze";

import { askText, isAiConfigured } from "./codebuddy";
import { resolveAiTimeoutMs } from "./config";

/**
 * 本链路的超时**下限**。自由文本分析要读最长 2000 字的输入、再做归纳，
 * 与问答同一量级，沿用问答的 120 秒下限（理由见 `qa-answerer.ts` 的注释）。
 */
const TIMEOUT_FLOOR_MS = 120_000;

function resolveTimeoutMs(): number {
  return Math.max(resolveAiTimeoutMs(), TIMEOUT_FLOOR_MS);
}

function buildPrompt(text: string): string {
  const directions = INTEREST_DIRECTION_ORDER.map(
    (id) => `- ${id}：${INTEREST_DIRECTIONS[id]}（${INTEREST_DIRECTION_DESCRIPTIONS[id]}）`,
  ).join("\n");

  return [
    "你在帮一个大学生做「科研兴趣发现」。他写了一段自己的日常想法、灵感、遇到的问题或自己的长处，",
    "你的任务是从这段文字里发现他身上的亮点（闪光点、长处、值得注意的特质），并据此推断他可能感兴趣的科研方向。",
    "",
    "【他写的】",
    text,
    "",
    "【可选方向】只能从下面这些 id 里挑，返回它们的 id，不要造新方向：",
    directions,
    "",
    "【要输出的字段】",
    "1. highlights：2～5 条，每条一句具体的话，说清他身上有什么亮点（要落到他写的内容上，不是空泛夸奖）。",
    "2. interestIds：1～3 个方向 id，从上面的目录里挑。",
    "3. rationale：一句话解释为什么判断是这些方向。",
    "4. response：给他的一句回应或鼓励，不超过 40 字（也可以返回空字符串）。",
    "",
    "【硬要求】",
    "- 不要说他「很棒」「有天赋」这类空话，亮点要具体可对应到他写的内容。",
    "- 方向 id 必须从上面的目录里挑，不能自己造。",
    "- 只输出一个 JSON 对象，不要代码块标记、不要任何解释：",
    '{"highlights":["..."],"interestIds":["it-ai"],"rationale":"...","response":"..."}',
  ].join("\n");
}

/**
 * 分析一段自由文本。返回 `null` 表示失败或输出不合法，由调用方兜底。
 */
export async function analyzeSpark(text: string): Promise<SparkAnalysis | null> {
  if (!isAiConfigured()) {
    console.error("[ai] 奇思妙想分析跳过：未配置密钥");
    return null;
  }

  const result = await askText(buildPrompt(text), {
    timeoutMs: resolveTimeoutMs(),
    // 内容生成类任务用 fast-model：default（auto）会间歇「只吐 thinking、不吐正文」
    // 导致 `code=empty`（见 codebuddy.ts 文件头诊断），fast-model 稳定且快得多。
    model: "fast-model",
  });
  if (!result.ok) {
    console.error(`[ai] 奇思妙想分析降级：code=${result.code}`);
    return null;
  }

  const analysis = parseSparkAnalysis({
    modelText: result.text,
    id: `spark-analysis-${randomUUID()}`,
    text,
    generatedAt: new Date().toISOString(),
  });
  if (!analysis) {
    console.error("[ai] 奇思妙想分析降级：输出未通过校验");
    if (process.env.SERVER_AI_DEBUG === "1") {
      console.error(`[ai] 模型输出原文 len=${result.text.length} text=${JSON.stringify(result.text.slice(0, 800))}`);
    }
    return null;
  }

  console.error(
    `[ai] 奇思妙想分析完成 耗时=${result.durationMs}ms 亮点=${analysis.highlights.length} 方向=${analysis.interests.length}`,
  );
  return analysis;
}
