import type { GraduationReminder, GraduationSummary } from "@/contracts";
import {
  buildRuleReminder,
  buildRuleSummary,
  parseProgressAiInput,
  type ProgressAiInput,
} from "@/features/graduation/progress-advice";
import { SCHOOL_MILESTONES } from "@/features/graduation/school-milestones";
import {
  generateProgressReminder,
  generateProgressSummary,
} from "@/server/ai/graduation-coach";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";

/**
 * 学生进度 AI 的两个接口。
 *
 * 共同约定：
 * - **必须带会话**（与问答 / 测评一致），避免公开站点上的匿名脚本刷付费额度；
 * - 入参由 `parseProgressAiInput` 统一校验，坏数据直接 400，不喂给模型；
 * - AI 失败不是错误：回落规则提醒 / 规则汇总，照常 200 返回，界面标注来源即可。
 */

type InputResult =
  | { ok: true; input: ProgressAiInput }
  | { ok: false; response: Response };

async function resolveInput(request: Request): Promise<InputResult> {
  const resolved = await readSession(request.headers.get("cookie"));
  if (!resolved) {
    return { ok: false, response: jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再试。") };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("BAD_REQUEST", "请求体不是合法的 JSON。") };
  }

  const input = parseProgressAiInput(body);
  if (!input) {
    return { ok: false, response: jsonError("BAD_REQUEST", "进度数据不完整或格式不正确。") };
  }
  return { ok: true, input };
}

export async function handleGraduationReminder(request: Request) {
  try {
    const resolved = await resolveInput(request);
    if (!resolved.ok) return resolved.response;

    const { input } = resolved;
    const reminder =
      (await generateProgressReminder(input)) ??
      buildRuleReminder({ today: input.today, nodes: input.nodes, milestones: SCHOOL_MILESTONES });

    return jsonOk<GraduationReminder>(reminder);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleGraduationSummary(request: Request) {
  try {
    const resolved = await resolveInput(request);
    if (!resolved.ok) return resolved.response;

    const { input } = resolved;
    const summary =
      (await generateProgressSummary(input)) ??
      buildRuleSummary({ today: input.today, nodes: input.nodes, milestones: SCHOOL_MILESTONES });

    return jsonOk<GraduationSummary>(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
