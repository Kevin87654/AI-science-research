/**
 * 浏览器侧 HTTP 客户端（B 负责）。
 *
 * 只做三件事：解包 `ApiResponse<T>`、把网络异常翻译成用户能看懂的话、提供会话获取。
 * **不在这里做业务判断**，也不缓存数据——权威数据一律来自服务端。
 *
 * 之所以带上 `NETWORK` 这个非契约错误码：`ApiErrorCode` 描述的是服务端返回的业务错误，
 * 而"请求根本没发出去"是客户端独有的情况，混进契约会让服务端多一个永远不会出现的枚举值。
 */
import type { ApiErrorCode, ApiResponse, SessionResponse } from "@/contracts";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ApiErrorCode | "NETWORK"; message: string };

const NETWORK_MESSAGE = "网络连接失败，请检查网络后重试。";
const MALFORMED_MESSAGE = "服务器返回了无法识别的内容，请重试。";

export async function request<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, code: "NETWORK", message: NETWORK_MESSAGE };
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    return { ok: false, code: "NETWORK", message: MALFORMED_MESSAGE };
  }

  if (payload.ok) return { ok: true, data: payload.data };
  return { ok: false, code: payload.error.code, message: payload.error.message };
}

export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * 确保存在匿名会话。
 *
 * `GET /api/session` 在没有会话时**故意**返回 401 而不隐式创建，
 * 所以这里显式地在 401 时补一次 POST —— 让"没身份"和"新身份"在服务端保持可区分。
 */
export async function ensureSession(): Promise<ApiResult<SessionResponse>> {
  const current = await request<SessionResponse>("/api/session");
  if (current.ok) return current;
  if (current.code !== "UNAUTHORIZED") return current;
  return request<SessionResponse>("/api/session", { method: "POST" });
}
