/**
 * 匿名会话的状态与令牌（服务端专用）。
 *
 * 方案 A：服务端生成随机令牌 → **只把 SHA-256 落库** → 通过 HttpOnly Cookie 下发。
 * 数据库里看不到明文令牌，Cookie 也不能被前端脚本读取。
 *
 * 不使用 CloudBase Auth，也不采集真实姓名、学号、手机号。
 * 该文件只依赖 `node:crypto`，不导入其他运行时模块，可被 Node 自带测试直接运行。
 */
import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions } from "./cookie";

export const SESSION_COOKIE_NAME = "ssr_session";

/** 30 天。匿名用户不该被频繁要求重新开始。 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const TOKEN_BYTES = 32;

/** base64url 编码 32 字节 = 43 个字符。 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface SessionToken {
  /** 明文令牌，只出现在 Cookie 里，**不落库、不写日志**。 */
  token: string;
  /** 落库用的摘要。 */
  tokenHash: string;
}

export function createSessionToken(): SessionToken {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * 先做形状校验再查库：拿一个明显不是令牌的值（空串、超长、含非法字符）
 * 去打数据库是白花一次 8 秒预算内的往返，也容易被拿来试探。
 */
export function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function getSessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAgeSeconds: SESSION_TTL_SECONDS,
  };
}

/** 是否在 HTTPS 环境。Vercel 上是；本地 http 开发时关闭 Secure，否则浏览器不保存。 */
export function shouldUseSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 会话过期判断。`expiresAt` 为 null 表示不过期（当前不使用这种配置）。 */
export function isExpired(expiresAt: string | null, nowIso: string): boolean {
  if (expiresAt === null) return false;
  return Date.parse(expiresAt) <= Date.parse(nowIso);
}
