import type { SessionResponse } from "@/contracts";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { getOrCreateSession, readSession } from "@/server/services/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读取当前会话。没有就明确返回 401，**不隐式创建** —— 免得把"没身份"和"新身份"混为一谈。 */
export async function GET(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "还没有会话，请先开始使用。");
    }
    const data: SessionResponse = {
      session: resolved.session,
      expiresAt: resolved.expiresAt,
    };
    return jsonOk(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 建立匿名会话（已有时原样返回，不重复下发 Cookie）。
 * 用户标识是服务端生成的，客户端不需要、也不应该提供任何身份信息。
 */
export async function POST(request: Request) {
  try {
    const issued = await getOrCreateSession(request.headers.get("cookie"));
    const data: SessionResponse = {
      session: issued.session,
      expiresAt: issued.expiresAt,
    };
    return jsonOk(data, issued.setCookie ? { "Set-Cookie": issued.setCookie } : {});
  } catch (error) {
    return toErrorResponse(error);
  }
}
