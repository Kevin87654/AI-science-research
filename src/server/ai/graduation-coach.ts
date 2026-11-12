import "server-only";

/**
 * 学生毕设进度的 AI 能力（2026-11-12 新增）。
 *
 * 只做两件事，都是"读事实 → 写一段话"，不替学生改节点、不替学院下结论：
 *   1. `generateProgressReminder`：把学生节点和学院时间轴放在一起，指出接下来该做什么；
 *   2. `generateProgressSummary`：把阶段成果整理成一条可直接发给导师的汇报。
 *
 * 两条硬约束沿用全站：
 *   · **只依据给它的数据**：提示词里明确禁止编造学生没做过的事和学院没写过的日期；
 *   · **失败返回 `null`**，由 API 层降级到 `progress-advice.ts` 的规则版本，页面永远有结果。
 */
import type { GraduationReminder, GraduationSummary } from "@/contracts";
import { findAccountById } from "@/features/auth/demo-accounts";
import type { ProgressAiInput } from "@/features/graduation/progress-advice";
import { parseReminderDraft, parseSummaryDraft } from "@/features/graduation/progress-advice";
import { buildReminderPrompt, buildSummaryPrompt } from "@/features/graduation/progress-prompts";

import { askText, isAiConfigured } from "./client";

/** 生成进度提醒。返回 `null` 表示这次不可用，调用方回落规则提醒。 */
export async function generateProgressReminder(
  input: ProgressAiInput,
): Promise<GraduationReminder | null> {
  if (!isAiConfigured()) return null;

  const result = await askText(buildReminderPrompt(input), {
    json: true,
    temperature: 0.3,
    maxTokens: 700,
  });
  if (!result.ok) {
    console.error(`[ai] 进度提醒降级为规则：code=${result.code}`);
    return null;
  }

  const draft = parseReminderDraft(result.text);
  if (!draft) {
    console.error("[ai] 进度提醒降级为规则：输出未通过校验");
    if (process.env.SERVER_AI_DEBUG === "1") {
      console.error(`[ai] 模型输出原文 len=${result.text.length} text=${JSON.stringify(result.text.slice(0, 800))}`);
    }
    return null;
  }

  console.error(`[ai] 进度提醒完成 耗时=${result.durationMs}ms 条目=${draft.items.length}`);
  return { source: "ai", headline: draft.headline, items: draft.items };
}

/** 生成阶段性成果汇总。返回 `null` 表示这次不可用，调用方回落规则汇总。 */
export async function generateProgressSummary(
  input: ProgressAiInput,
): Promise<GraduationSummary | null> {
  if (!isAiConfigured()) return null;

  const result = await askText(buildSummaryPrompt(input, findAccountById(input.studentId)?.name), {
    json: true,
    temperature: 0.4,
    // 总结要写 300～500 字。2026-11-12 实测：high 推理会吃掉大量 token，
    // 1400 上限会把正文截断成不完整 JSON；low + 2500 稳定完整，且更快。
    reasoningEffort: "low",
    maxTokens: 2500,
  });
  if (!result.ok) {
    console.error(`[ai] 成果汇总降级为规则：code=${result.code}`);
    return null;
  }

  const draft = parseSummaryDraft(result.text);
  if (!draft) {
    console.error("[ai] 成果汇总降级为规则：输出未通过校验");
    if (process.env.SERVER_AI_DEBUG === "1") {
      console.error(`[ai] 模型输出原文 len=${result.text.length} text=${JSON.stringify(result.text.slice(0, 800))}`);
    }
    return null;
  }

  console.error(`[ai] 成果汇总完成 耗时=${result.durationMs}ms 节点=${input.nodes.length} 字数=${draft.body.length}`);
  return {
    source: "ai",
    title: draft.title,
    body: draft.body,
    nodeCount: input.nodes.length,
  };
}
