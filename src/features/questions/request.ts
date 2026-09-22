/**
 * 问答接口的入参校验（纯函数）。
 *
 * 单独成文件而不是写在 Route Handler 里，是为了让"什么算合法请求"能脱离 HTTP 单测 ——
 * 入参校验是最容易被改坏、又最难在手工点页面时发现的一层。
 *
 * 校验口径与 `engine.ts` 的兜底**故意不完全一致**：
 * - **这里**是"请求合不合法"，不合法就返回 400，不浪费一次引擎调用；
 * - **引擎里**是"用户问得对不对"，比如问题过长会得到一句"请缩短到 500 字以内"。
 *
 * 看起来重复，其实是两个不同的判断：接口层拒的是**畸形请求**（缺字段、类型不对），
 * 引擎层接的是**正常形状但内容不合适**的提问（超长、空、讲别的）。把两者混在一起，
 * 要么让畸形请求穿透到业务层，要么让"问得太长"变成一条冷冰冰的 400。
 */
import { MAX_QUESTION_LENGTH } from "./engine.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 解析请求体。返回 `null` 表示请求畸形，调用方应当回 400。
 *
 * ⚠️ **只认识 `question` 一个字段。** 请求体里如果带了 `userId` 之类的身份字段，
 * 一律忽略 —— 身份只能由服务端从会话解析（契约铁律 1）。
 * 不在这里报错是因为"多带字段"不构成攻击面，服务端不读它就是安全的。
 */
export function parseQuestionRequest(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const { question } = body;
  if (typeof question !== "string") return null;
  // 上限卡在接口层，避免把超长文本（乃至一段粘贴进来的整篇文档）送进引擎与日志。
  if (question.length > MAX_QUESTION_LENGTH) return null;

  return question;
}
