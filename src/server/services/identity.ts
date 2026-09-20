import "server-only";

import type { IsoDateTime, Session } from "@/contracts";
import { parseCookies, serializeCookie } from "@/server/auth/cookie";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getSessionCookieOptions,
  hashToken,
  isExpired,
  isPlausibleToken,
  shouldUseSecureCookie,
} from "@/server/auth/session";
import { sessionRepository } from "@/server/repositories";
import type { SessionRecord } from "@/server/repositories/types";

/**
 * 匿名会话。
 *
 * 这是「身份只能由服务端确认」这条铁律唯一的实现点：
 * 业务代码一律通过这里拿 `userId`，**永远不要**去读请求体或查询参数里的用户标识。
 */
export interface ResolvedSession {
  session: Session;
  expiresAt: IsoDateTime | null;
}

export interface IssuedSession extends ResolvedSession {
  /** 需要下发新 Cookie 时才有值。 */
  setCookie: string | null;
}

function toSession(record: SessionRecord): Session {
  return {
    userId: record.userId,
    kind: "anonymous",
    accountType: record.accountType,
    createdAt: record.createdAt,
  };
}

/** 读取已有会话，不做任何创建。无效、过期或缺失都返回 `null`。 */
export async function readSession(cookieHeader: string | null): Promise<ResolvedSession | null> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE_NAME];
  if (!isPlausibleToken(token)) return null;

  const record = await sessionRepository.findByTokenHash(hashToken(token));
  if (!record) return null;

  if (isExpired(record.expiresAt, new Date().toISOString())) {
    await sessionRepository.removeByTokenHash(record.tokenHash);
    return null;
  }

  return { session: toSession(record), expiresAt: record.expiresAt };
}

/**
 * 拿到会话，没有就新建一个。
 * 已有会话时**不重新下发 Cookie**，避免每次请求都把有效期往后推。
 */
export async function getOrCreateSession(cookieHeader: string | null): Promise<IssuedSession> {
  const existing = await readSession(cookieHeader);
  if (existing) {
    return { ...existing, setCookie: null };
  }

  const { token, tokenHash } = createSessionToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const record = await sessionRepository.create({
    tokenHash,
    accountType: "anonymous",
    expiresAt,
    now,
  });

  const setCookie = serializeCookie(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(shouldUseSecureCookie()),
  );

  return { session: toSession(record), expiresAt, setCookie };
}
