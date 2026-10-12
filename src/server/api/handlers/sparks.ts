import type { SparkAnalyzeResponse } from "@/contracts";
import { parseSparkRequest } from "@/features/spark/request";
import { analyzeSpark } from "@/server/ai/spark-analyzer";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";


/**
 * 「奇思妙想」分析接口。
 *
 * 输入一段自由文本（想法 / 灵感 / 日常记录 / 问题 / 长处），返回 AI 分析出的
 * 亮点与兴趣方向。调用的是付费模型，所以与问答、测评一样**必须带会话**，
 * 身份只从服务端会话解析，请求体里的身份字段一律不采信（契约铁律 1）。
 */
export async function handleSparks(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再试。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }

    const text = parseSparkRequest(body);
    if (text === null) {
      return jsonError("BAD_REQUEST", "输入格式不正确：请提交非空的 text 字段，且不超过长度上限。");
    }

    const analysis = await analyzeSpark(text);
    if (!analysis) {
      return jsonError("UPSTREAM_UNAVAILABLE", "AI 暂时不可用，请稍后再试。");
    }

    return jsonOk<SparkAnalyzeResponse>({ analysis });
  } catch (error) {
    return toErrorResponse(error);
  }
}
