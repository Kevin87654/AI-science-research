#!/usr/bin/env node
/**
 * 匿名身份与数据隔离的验收脚本（HTTP 层）。
 *
 * 用法：
 *   pnpm build && pnpm start        # 另开一个终端
 *   node scripts/verify/identity-isolation.mjs [baseUrl]
 *
 * 默认 baseUrl 为 http://127.0.0.1:3000。全部通过时退出码为 0。
 *
 * 它验证的是「单测之外」的那一半：真实的 Cookie 往返、状态码、响应头，
 * 以及**两个会话互相看不到对方的进度**。
 */

const baseUrl = (process.argv[2] ?? process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;

function check(condition, label, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function call(path, { method = "GET", cookie, body, raw } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : raw ?? JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return { status: response.status, json, text, setCookies, headers: response.headers };
}

function cookiePair(setCookies) {
  const raw = setCookies[0] ?? "";
  return raw.split(";")[0];
}

console.log(`目标：${baseUrl}\n`);

// ── 1. 建立会话
console.log("1. 建立匿名会话");
const created = await call("/api/session", { method: "POST" });
check(created.status === 200, "POST /api/session 返回 200", `实际 ${created.status}`);
check(created.json?.ok === true, "响应结构为 { ok: true, data }");
check(created.setCookies.length === 1, "下发了 1 个 Set-Cookie", `实际 ${created.setCookies.length}`);
const setCookie = created.setCookies[0] ?? "";
check(/HttpOnly/i.test(setCookie), "Cookie 带 HttpOnly");
check(/SameSite=Lax/i.test(setCookie), "Cookie 带 SameSite=Lax");
check(setCookie.includes("Path=/"), "Cookie 限定 Path=/");
check(created.headers.get("cache-control") === "no-store", "响应不缓存（no-store）");

const userA = created.json?.data?.session?.userId;
check(typeof userA === "string" && userA.length > 0, "返回了服务端生成的 userId");
check(created.json?.data?.session?.kind === "anonymous", "身份类型为 anonymous");
check(created.json?.data?.session?.accountType === "anonymous", "账号类型为 anonymous");

const cookieA = cookiePair(created.setCookies);
const tokenFromCookie = cookieA.split("=")[1] ?? "";
check(tokenFromCookie.length > 0, "Cookie 里有令牌");
check(created.text.includes(tokenFromCookie) === false, "响应正文里没有明文令牌");

// ── 2. 会话读取
console.log("\n2. 读取会话");
const readA = await call("/api/session", { cookie: cookieA });
check(readA.status === 200, "带 Cookie 能读到会话", `实际 ${readA.status}`);
check(readA.json?.data?.session?.userId === userA, "读到的是同一个 userId");
check(readA.setCookies.length === 0, "已有会话时不重复下发 Cookie");

const noCookie = await call("/api/session");
check(noCookie.status === 401, "不带 Cookie 返回 401", `实际 ${noCookie.status}`);
check(noCookie.json?.error?.code === "UNAUTHORIZED", "错误码为 UNAUTHORIZED");

const garbage = await call("/api/session", { cookie: "ssr_session=not-a-real-token" });
check(garbage.status === 401, "乱填令牌返回 401", `实际 ${garbage.status}`);

// ── 3. 进度读写
console.log("\n3. 写入并读回自己的进度");
const roadmapId = "roadmap-verify";
const writeA = await call("/api/progress", {
  method: "POST",
  cookie: cookieA,
  body: { roadmapId, taskId: "task-a", status: "completed", note: "A 的备注" },
});
check(writeA.status === 200, "POST /api/progress 返回 200", `实际 ${writeA.status}`);
check(writeA.json?.data?.userId === userA, "快照归属正确");
check(writeA.json?.data?.items?.length === 1, "快照里有 1 条记录");

const readProgressA = await call(`/api/progress?roadmapId=${encodeURIComponent(roadmapId)}`, { cookie: cookieA });
check(readProgressA.status === 200, "GET /api/progress 返回 200");
check(readProgressA.json?.data?.items?.[0]?.note === "A 的备注", "刷新后读回同一条备注");
check(readProgressA.json?.data?.items?.[0]?.status === "completed", "状态正确");

// ── 4. 第二个会话
console.log("\n4. 第二个会话（模拟另一台浏览器）");
const createdB = await call("/api/session", { method: "POST" });
const cookieB = cookiePair(createdB.setCookies);
const userB = createdB.json?.data?.session?.userId;
check(createdB.status === 200 && typeof userB === "string", "第二个会话建立成功");
check(userA !== userB, "两个会话的用户标识不同");

// ── 5. 隔离
console.log("\n5. ⭐ 隔离：第二个会话看不到第一个会话的数据");
const readProgressB = await call(`/api/progress?roadmapId=${encodeURIComponent(roadmapId)}`, { cookie: cookieB });
check(readProgressB.status === 200, "B 的查询正常返回");
check(readProgressB.json?.data?.items?.length === 0, "B 看到 0 条记录");
check(readProgressB.text.includes("A 的备注") === false, "B 的响应里没有 A 的备注");
check(readProgressB.json?.data?.userId === userB, "B 拿到的是自己的 userId");

const stillA = await call(`/api/progress?roadmapId=${encodeURIComponent(roadmapId)}`, { cookie: cookieA });
check(stillA.json?.data?.items?.[0]?.note === "A 的备注", "A 的数据没有被影响");

// ── 6. 伪造他人标识
console.log("\n6. ⭐ 伪造他人标识");
const forged = await call("/api/progress", {
  method: "POST",
  cookie: cookieB,
  body: { roadmapId, taskId: "task-forged", status: "completed", userId: userA },
});
check(forged.status === 403, "带他人 userId 写入返回 403", `实际 ${forged.status}`);
check(forged.json?.error?.code === "FORBIDDEN", "错误码为 FORBIDDEN");

const afterForged = await call(`/api/progress?roadmapId=${encodeURIComponent(roadmapId)}`, { cookie: cookieA });
check(afterForged.json?.data?.items?.length === 1, "A 的记录没有被写进伪造的那条");

const ownIdAllowed = await call("/api/progress", {
  method: "POST",
  cookie: cookieB,
  body: { roadmapId, taskId: "task-b", status: "in-progress", userId: userB },
});
check(ownIdAllowed.status === 200, "带自己的 userId 是允许的");

// ── 7. 入参校验
console.log("\n7. 入参校验");
const noSession = await call("/api/progress", {
  method: "POST",
  body: { roadmapId, taskId: "x", status: "completed" },
});
check(noSession.status === 401, "没有会话时写入返回 401", `实际 ${noSession.status}`);

const badStatus = await call("/api/progress", {
  method: "POST",
  cookie: cookieA,
  body: { roadmapId, taskId: "x", status: "finished" },
});
check(badStatus.status === 400, "非法状态值返回 400", `实际 ${badStatus.status}`);
check(badStatus.json?.error?.code === "BAD_REQUEST", "错误码为 BAD_REQUEST");

const brokenJson = await call("/api/progress", {
  method: "POST",
  cookie: cookieA,
  raw: "{not json",
});
check(brokenJson.status === 400, "畸形 JSON 返回 400", `实际 ${brokenJson.status}`);

const tooLongNote = await call("/api/progress", {
  method: "POST",
  cookie: cookieA,
  body: { roadmapId, taskId: "x", status: "completed", note: "a".repeat(501) },
});
check(tooLongNote.status === 400, "超长备注返回 400", `实际 ${tooLongNote.status}`);

const missingRoadmap = await call("/api/progress", { cookie: cookieA });
check(missingRoadmap.status === 400, "缺 roadmapId 返回 400", `实际 ${missingRoadmap.status}`);

// ── 8. 存活接口未受影响
console.log("\n8. 回归：存活接口仍然正常");
const ping = await call("/api/ping");
check(ping.status === 200 && ping.json?.data?.application === "ready", "/api/ping 正常");

console.log(`\n结果：${passed} 通过 / ${failed} 未通过`);
process.exit(failed === 0 ? 0 : 1);
