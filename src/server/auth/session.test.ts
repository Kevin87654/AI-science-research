import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getSessionCookieOptions,
  hashToken,
  isExpired,
  isPlausibleToken,
} from "./session.ts";

test("令牌形状与摘要", () => {
  const { token, tokenHash } = createSessionToken();
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(tokenHash.length, 64);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
});

test("每次生成的令牌都不同", () => {
  const seen = new Set(Array.from({ length: 200 }, () => createSessionToken().token));
  assert.equal(seen.size, 200);
});

test("摘要可复现，且不同令牌摘要不同", () => {
  const a = createSessionToken();
  assert.equal(hashToken(a.token), a.tokenHash);
  assert.notEqual(hashToken(a.token), hashToken(createSessionToken().token));
});

test("摘要不可逆：记录里不应出现明文令牌", () => {
  const { token, tokenHash } = createSessionToken();
  assert.equal(tokenHash.includes(token), false);
});

test("形状校验会挡掉明显不是令牌的值", () => {
  assert.equal(isPlausibleToken(createSessionToken().token), true);
  assert.equal(isPlausibleToken(""), false);
  assert.equal(isPlausibleToken("too-short"), false);
  assert.equal(isPlausibleToken("a".repeat(44)), false);
  assert.equal(isPlausibleToken(`${"a".repeat(42)}!`), false);
  assert.equal(isPlausibleToken(undefined), false);
  assert.equal(isPlausibleToken(12345), false);
  assert.equal(isPlausibleToken(null), false);
});

test("cookie 属性固定为 HttpOnly + SameSite=Lax + 根路径", () => {
  const options = getSessionCookieOptions(true);
  assert.deepEqual(options, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAgeSeconds: SESSION_TTL_SECONDS,
  });
  assert.equal(SESSION_COOKIE_NAME, "ssr_session");
});

test("过期判断", () => {
  const now = "2026-09-20T12:00:00.000Z";
  assert.equal(isExpired(null, now), false);
  assert.equal(isExpired("2026-09-20T12:00:01.000Z", now), false);
  assert.equal(isExpired("2026-09-20T11:59:59.000Z", now), true);
  // 恰好等于当前时刻视为已过期
  assert.equal(isExpired(now, now), true);
});
