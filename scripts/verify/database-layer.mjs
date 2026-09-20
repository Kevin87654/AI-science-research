#!/usr/bin/env node
/**
 * 数据库层验收脚本 —— 验证 `postgrest.ts` 依赖的那些 SQL/HTTP 语义是否真的成立。
 *
 * 用法：
 *   node --env-file=.env.local scripts/verify/database-layer.mjs
 *
 * 它针对**真实的 CloudBase PostgreSQL**执行，用完会自己清理测试数据。
 * 与 `identity-isolation.mjs` 的分工：
 *   · 这个脚本验证**数据库层**（约束、upsert 语义、错误码、类型往返）—— 不需要起应用；
 *   · 那个脚本验证**应用层**（Cookie、身份、两个会话的隔离）—— 需要先 build + start。
 *
 * 为什么单独有这么一个脚本：`postgrest.ts` 里的错误码映射、upsert 写法、字段名
 * 全是对数据库行为的**假设**，跑一遍才敢说它们成立。
 */

const baseUrl = (process.env.SERVER_CLOUDBASE_PG_REST_BASE_URL ?? "").replace(/\/+$/, "");
const apiKey = process.env.SERVER_CLOUDBASE_PG_API_KEY ?? "";

if (!baseUrl || !apiKey) {
  console.error("缺少 SERVER_CLOUDBASE_PG_REST_BASE_URL / SERVER_CLOUDBASE_PG_API_KEY（请用 --env-file=.env.local）");
  process.exit(2);
}

const REST = `${baseUrl}/v1/rdb/rest`;
const MARK = `verify-${Date.now()}`;
const ROADMAP = `roadmap-${MARK}`;

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

async function call(method, path, { body, prefer } = {}) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${REST}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

/** 从网关错误里取我们自己关心的 code 字段（server 端只认这个，不读 message）。 */
function errorCode(result) {
  return typeof result.json?.code === "string" ? result.json.code : "";
}

console.log(`目标：${REST}\n标记：${MARK}\n`);

const sessionA = crypto.randomUUID();
const sessionB = crypto.randomUUID();
const tokenHashA = `hash-${MARK}-a`;
const tokenHashB = `hash-${MARK}-b`;

try {
  // ── 1. 会话表
  console.log("1. sessions：插入与按摘要查询");
  const createdA = await call("POST", "/sessions?select=user_id,token_hash,account_type,created_at,expires_at", {
    body: {
      user_id: sessionA,
      token_hash: tokenHashA,
      account_type: "anonymous",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
    prefer: "return=representation",
  });
  check(createdA.status === 201 || createdA.status === 200, "插入会话成功", `实际 ${createdA.status}`);
  const rowA = createdA.json?.[0];
  check(rowA?.user_id === sessionA, "返回的 user_id 与写入一致");
  check(rowA?.account_type === "anonymous", "account_type 正确");
  check(typeof rowA?.created_at === "string" && rowA.created_at.includes("T"), "created_at 是带时区的 ISO 字符串");
  console.log(`       created_at 实际格式：${rowA?.created_at}`);

  const found = await call("GET", `/sessions?select=*&token_hash=eq.${tokenHashA}&limit=1`);
  check(found.status === 200 && found.json?.length === 1, "按 token_hash 精确查回 1 行");

  const notFound = await call("GET", `/sessions?select=user_id&token_hash=eq.no-such-hash-${MARK}&limit=1`);
  check(notFound.status === 200 && notFound.json?.length === 0, "查不到时返回空数组（而不是报错）");

  // 唯一约束：同 token_hash 再插一次
  // 实测：网关对**唯一/外键冲突**返回 409（不是 400）；check 约束仍是 400。错误码才是判据。
  const dup = await call("POST", "/sessions", {
    body: { user_id: crypto.randomUUID(), token_hash: tokenHashA, account_type: "anonymous" },
  });
  check(dup.status === 409, "重复 token_hash 被拒绝（409）", `实际 ${dup.status}`);
  check(errorCode(dup) === "DATABASE_23505", "错误码是 23505（唯一约束）", `实际 ${errorCode(dup)}`);

  // ── 2. 进度表：upsert 语义
  console.log("\n2. task_progress：upsert 是「覆盖」而不是「新增」");
  const upsertPath = "/task_progress?select=user_id,roadmap_id,task_id,status,note,updated_at&on_conflict=user_id,roadmap_id,task_id";
  const first = await call("POST", upsertPath, {
    body: {
      user_id: sessionA,
      roadmap_id: ROADMAP,
      task_id: "task-1",
      status: "in-progress",
      note: "第一次",
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  check(first.status === 201 || first.status === 200, "首次 upsert 成功", `实际 ${first.status}`);
  check(first.json?.[0]?.status === "in-progress", "首次写入的状态正确");

  const second = await call("POST", upsertPath, {
    body: {
      user_id: sessionA,
      roadmap_id: ROADMAP,
      task_id: "task-1",
      status: "completed",
      note: "第二次",
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  check(second.status === 200, "同一主键再次 upsert 返回 200（走更新分支）", `实际 ${second.status}`);
  check(second.json?.[0]?.status === "completed", "状态被覆盖为 completed");
  check(second.json?.[0]?.note === "第二次", "备注被覆盖");

  const countAfter = await call("GET", `/task_progress?select=task_id&user_id=eq.${sessionA}&roadmap_id=eq.${ROADMAP}`);
  check(countAfter.json?.length === 1, "整条记录只有 1 行（没有新增出第二行）", `实际 ${countAfter.json?.length}`);

  // ── 3. 归属过滤
  console.log("\n3. 归属过滤：别人的数据查不到");
  await call("POST", "/sessions", {
    body: { user_id: sessionB, token_hash: tokenHashB, account_type: "anonymous" },
  });
  const otherUser = await call("GET", `/task_progress?select=task_id&user_id=eq.${sessionB}&roadmap_id=eq.${ROADMAP}`);
  check(otherUser.status === 200 && otherUser.json?.length === 0, "另一个用户查到 0 行");
  check(otherUser.text.includes("第二次") === false, "另一个用户的响应里没有对方的数据");

  // ── 4. 约束：错误码映射是否如我们假设
  console.log("\n4. 约束错误 —— 验证 postgrest.ts 的错误码映射");
  const badStatus = await call("POST", "/task_progress", {
    body: { user_id: sessionA, roadmap_id: ROADMAP, task_id: "task-2", status: "finished" },
  });
  check(badStatus.status === 400, "非法 status 被拒绝（400）", `实际 ${badStatus.status}`);
  check(errorCode(badStatus) === "DATABASE_23514", "错误码是 23514（check 约束）", `实际 ${errorCode(badStatus)}`);

  const longNote = await call("POST", "/task_progress", {
    body: { user_id: sessionA, roadmap_id: ROADMAP, task_id: "task-3", status: "completed", note: "a".repeat(501) },
  });
  check(longNote.status === 400 && errorCode(longNote) === "DATABASE_23514", "超长备注被拒绝（23514）", `实际 ${errorCode(longNote)}`);

  const orphan = await call("POST", "/task_progress", {
    body: { user_id: crypto.randomUUID(), roadmap_id: ROADMAP, task_id: "task-4", status: "completed" },
  });
  check(orphan.status === 409, "给不存在的用户写进度被拒绝（409）", `实际 ${orphan.status}`);
  check(errorCode(orphan) === "DATABASE_23503", "错误码是 23503（外键约束）", `实际 ${errorCode(orphan)}`);

  // ── 5. 不存在的表 → 404（用来确认鉴权与路由正常）
  console.log("\n5. 路由与鉴权判据");
  const noTable = await call("GET", "/no_such_table_verify?select=*");
  check(noTable.status === 404 && errorCode(noTable) === "DATABASE_PGRST205", "不存在的表返回 404 PGRST205（证明鉴权通过）", `实际 ${noTable.status} ${errorCode(noTable)}`);

  const noAuth = await fetch(`${REST}/sessions?select=user_id&limit=1`);
  check(noAuth.status === 401, "不带密钥返回 401", `实际 ${noAuth.status}`);
} finally {
  // ── 6. 清理（会话删掉会级联删掉进度）
  console.log("\n6. 清理测试数据");
  const delA = await call("DELETE", `/sessions?user_id=eq.${sessionA}`);
  const delB = await call("DELETE", `/sessions?user_id=eq.${sessionB}`);
  check(delA.status === 204 || delA.status === 200, "删除会话 A", `实际 ${delA.status}`);
  check(delB.status === 204 || delB.status === 200, "删除会话 B", `实际 ${delB.status}`);

  const leftProgress = await call("GET", `/task_progress?select=task_id&roadmap_id=eq.${ROADMAP}`);
  check(leftProgress.json?.length === 0, "级联删除了进度记录", `残留 ${leftProgress.json?.length}`);
}

console.log(`\n结果：${passed} 通过 / ${failed} 未通过`);
process.exit(failed === 0 ? 0 : 1);
