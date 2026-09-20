import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCookies, serializeClearedCookie, serializeCookie } from "./cookie.ts";

const baseOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: true,
  maxAgeSeconds: 3600,
};

test("解析多个 cookie", () => {
  const parsed = parseCookies("a=1; b=2; ssr_session=abc");
  assert.deepEqual(parsed, { a: "1", b: "2", ssr_session: "abc" });
});

test("无请求头返回空对象", () => {
  assert.deepEqual(parseCookies(null), {});
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(""), {});
});

test("值里允许出现等号", () => {
  assert.deepEqual(parseCookies("token=a=b=c"), { token: "a=b=c" });
});

test("跳过没有名字的片段", () => {
  const parsed = parseCookies("=novalue; good=1; ; =;");
  assert.deepEqual(parsed, { good: "1" });
});

test("去掉包裹的引号", () => {
  assert.deepEqual(parseCookies('t="quoted"'), { t: "quoted" });
});

test("名字两侧空白被忽略", () => {
  assert.deepEqual(parseCookies("  a  =  1  ; b=2"), { a: "1", b: "2" });
});

test("序列化包含安全属性", () => {
  const cookie = serializeCookie("ssr_session", "tok", baseOptions);
  assert.ok(cookie.startsWith("ssr_session=tok;"));
  assert.ok(cookie.includes("Path=/"));
  assert.ok(cookie.includes("Max-Age=3600"));
  assert.ok(cookie.includes("SameSite=Lax"));
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
});

test("非 https 环境不输出 Secure", () => {
  const cookie = serializeCookie("s", "v", { ...baseOptions, secure: false });
  assert.equal(cookie.includes("Secure"), false);
});

test("清理 cookie 的 Max-Age 为 0 且不带安全属性变化", () => {
  const cookie = serializeClearedCookie("ssr_session", baseOptions);
  assert.ok(cookie.includes("Max-Age=0"));
  assert.ok(cookie.includes("HttpOnly"));
});
