/**
 * 「奇思妙想」接口的入参校验（B 负责，纯函数）。
 *
 * 与问答接口 `request.ts` 同一个理由：把「请求合不合法」抽出来单独测，
 * 畸形请求在接口层就返回 400，不浪费一次模型调用。
 *
 * ⚠️ 只认识 `text` 一个字段，请求体里多带的身份字段一律忽略 ——
 * 身份只能由服务端从会话解析（契约铁律 1）。
 */
import { MAX_SPARK_TEXT } from "./analyze.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 解析请求体，返回清洗后的文本；`null` 表示畸形（缺字段、非字符串、
 * 空输入或超长），调用方回 400。
 */
export function parseSparkRequest(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const { text } = body;
  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_SPARK_TEXT) return null;

  return trimmed;
}
