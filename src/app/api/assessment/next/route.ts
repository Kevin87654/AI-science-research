import type { AssessmentAnswer, AssessmentMode, AssessmentStepRequest } from "@/contracts";
import { nextAssessmentStep } from "@/server/ai/assessment-coach";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: readonly AssessmentMode[] = ["full", "demo"];

/**
 * 结构上限：一次测评最多这么多题。
 *
 * 这不只是"防脏数据"，也是**成本上限**：每题最多触发一次模型调用，
 * 而候选为空时根本不会调用模型，所以单次测评的 AI 调用次数天然被题库大小封住。
 */
const MAX_ANSWERS = 40;
const MAX_OPTIONS_PER_ANSWER = 12;
const MAX_QUESTION_ID_LENGTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMode(value: unknown): value is AssessmentMode {
  return typeof value === "string" && MODES.includes(value as AssessmentMode);
}

function parseAnswer(value: unknown): AssessmentAnswer | null {
  if (!isRecord(value)) return null;

  const { questionId, optionIds, unknown } = value;
  if (typeof questionId !== "string" || questionId.length === 0 || questionId.length > MAX_QUESTION_ID_LENGTH) {
    return null;
  }
  if (!Array.isArray(optionIds) || optionIds.length > MAX_OPTIONS_PER_ANSWER) return null;
  if (!optionIds.every((optionId) => typeof optionId === "string")) return null;
  if (typeof unknown !== "boolean") return null;

  return { questionId, optionIds: optionIds as string[], unknown };
}

function parseStepRequest(body: unknown): AssessmentStepRequest | null {
  if (!isRecord(body)) return null;

  const { mode, answers, askedQuestionIds } = body;
  if (!isMode(mode)) return null;
  if (!Array.isArray(answers) || answers.length > MAX_ANSWERS) return null;
  if (!Array.isArray(askedQuestionIds) || askedQuestionIds.length > MAX_ANSWERS) return null;

  const parsedAnswers: AssessmentAnswer[] = [];
  for (const answer of answers) {
    const parsed = parseAnswer(answer);
    if (!parsed) return null;
    parsedAnswers.push(parsed);
  }

  const parsedAsked: string[] = [];
  for (const id of askedQuestionIds) {
    if (typeof id !== "string" || id.length === 0 || id.length > MAX_QUESTION_ID_LENGTH) return null;
    parsedAsked.push(id);
  }

  return { mode, answers: parsedAnswers, askedQuestionIds: parsedAsked };
}

/**
 * 取下一题（一次只问一题）。
 *
 * ⚠️ **必须带会话**：这个接口会调用付费模型，匿名开放等于把密钥额度公开在互联网上。
 * 会话由服务端确认，请求体里的任何身份字段都不采信。
 *
 * 已知残余风险：攻击者仍可以「反复新建匿名会话」来绕过这一层。真正的限流要靠
 * 平台侧（Vercel 的速率限制 / WAF）或落库计数，属于后续项，不在本轮。
 */
export async function POST(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面重新开始测评。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }

    const parsed = parseStepRequest(body);
    if (!parsed) {
      return jsonError("BAD_REQUEST", "测评请求格式不正确。");
    }

    return jsonOk(await nextAssessmentStep(parsed));
  } catch (error) {
    return toErrorResponse(error);
  }
}
