import "server-only";

import { randomUUID } from "node:crypto";
import type { ApiErrorCode, ApiResponse } from "@/contracts";
import { RepositoryError } from "@/server/repositories/errors";

/** 用户数据一律不缓存。 */
const NO_STORE = { "Cache-Control": "no-store" };

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TIMEOUT: 504,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
};

/**
 * 统一成功响应。
 * `extraHeaders` 用于 `Set-Cookie` 这类必须带上的头。
 */
export function jsonOk<T>(data: T, extraHeaders: Record<string, string> = {}): Response {
  return Response.json({ ok: true, data } satisfies ApiResponse<T>, {
    headers: { ...NO_STORE, ...extraHeaders },
  });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const requestId = randomUUID();
  return Response.json(
    { ok: false, error: { code, message, requestId } } satisfies ApiResponse<never>,
    { status: STATUS_BY_CODE[code], headers: { ...NO_STORE, ...extraHeaders } },
  );
}

/**
 * 把内部错误映射成对外响应。
 * 数据层错误的文案是我们自己写的，可以直接用；**其他错误一律 INTERNAL**，
 * 只把错误名写进服务端日志，不返回给客户端。
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof RepositoryError) {
    return jsonError(error.code, error.message);
  }

  const requestId = randomUUID();
  const name = error instanceof Error ? error.name : typeof error;
  console.error(`[api] requestId=${requestId} unexpected error name=${name}`);

  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "服务暂时不可用，请稍后重试。",
        requestId,
      },
    } satisfies ApiResponse<never>,
    { status: 500, headers: NO_STORE },
  );
}
