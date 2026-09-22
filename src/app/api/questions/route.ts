import type { QuestionResult } from "@/contracts";
import { parseQuestionRequest } from "@/features/questions/request";
import { createQaProvider } from "@/server/resources/qa-provider";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 科研问答（C 模块）。
 *
 * 回答由 `@/server/resources/qa-provider` 给出：**AI 优先、规则兜底**。
 * 返回体里带着 `decidedBy`，由 provider 的每条回答自己声明 —— 界面据此如实标注
 * "模型生成 / 规则回答"，而不是从 provider 的静态类型去猜。
 *
 * ⚠️ **必须带会话**。理由与 `/api/assessment/next` 相同，而且更硬：
 * 这条链路会调用付费模型，匿名开放等于把密钥额度公开在互联网上。
 *
 * 身份只从服务端会话解析；请求体里的任何身份字段都不采信（契约铁律 1）。
 */
export async function POST(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再提问。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }

    const question = parseQuestionRequest(body);
    // 注意判 `null` 而不是 falsy：空字符串是**合法请求**，
    // 它应当得到引擎那句"请先输入一个问题。"，而不是一条冷冰冰的 400。
    if (question === null) {
      return jsonError("BAD_REQUEST", "问题格式不正确，请提交纯文本 question 字段。");
    }

    return jsonOk<QuestionResult>(await createQaProvider().answer(question));
  } catch (error) {
    return toErrorResponse(error);
  }
}
