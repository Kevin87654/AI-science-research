import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryProgressRepository, InMemorySessionRepository } from "./in-memory.ts";
import { RepositoryError } from "./errors.ts";

const NOW = "2026-09-20T12:00:00.000Z";

function assertRepositoryError(error: unknown, code: string): void {
  assert.ok(error instanceof RepositoryError, `期望 RepositoryError，实际 ${String(error)}`);
  assert.equal(error.code, code);
}

test("会话：按摘要可查回，明文令牌不出现在记录里", async () => {
  const repo = new InMemorySessionRepository();
  const created = await repo.create({
    tokenHash: "hash-a",
    accountType: "anonymous",
    expiresAt: null,
    now: NOW,
  });

  assert.ok(created.userId.startsWith("anon-"));
  assert.equal(created.createdAt, NOW);
  assert.equal(JSON.stringify(created).includes("hash-a"), true);

  const found = await repo.findByTokenHash("hash-a");
  assert.deepEqual(found, created);
});

test("会话：不同摘要互不可见，删除后查不到", async () => {
  const repo = new InMemorySessionRepository();
  await repo.create({ tokenHash: "hash-a", accountType: "anonymous", expiresAt: null, now: NOW });
  await repo.create({ tokenHash: "hash-b", accountType: "anonymous", expiresAt: null, now: NOW });

  const a = await repo.findByTokenHash("hash-a");
  const b = await repo.findByTokenHash("hash-b");
  assert.notEqual(a?.userId, b?.userId);
  assert.equal(await repo.findByTokenHash("hash-missing"), null);

  await repo.removeByTokenHash("hash-a");
  assert.equal(await repo.findByTokenHash("hash-a"), null);
  assert.notEqual(await repo.findByTokenHash("hash-b"), null);
});

test("会话：两个用户拿到的 id 不会重复", async () => {
  const repo = new InMemorySessionRepository();
  const ids = new Set<string>();
  for (let i = 0; i < 100; i += 1) {
    const created = await repo.create({
      tokenHash: `hash-${i}`,
      accountType: "anonymous",
      expiresAt: null,
      now: NOW,
    });
    ids.add(created.userId);
  }
  assert.equal(ids.size, 100);
});

test("会话：缺失摘要被拒绝", async () => {
  const repo = new InMemorySessionRepository();
  await assert.rejects(
    () => repo.create({ tokenHash: "", accountType: "anonymous", expiresAt: null, now: NOW }),
    (error: unknown) => {
      assertRepositoryError(error, "BAD_REQUEST");
      return true;
    },
  );
});

test("进度：同一用户写入后可读回", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", {
    roadmapId: "roadmap-1",
    taskId: "task-1",
    status: "completed",
    note: null,
    now: NOW,
  });

  const rows = await repo.listByUser("user-a", "roadmap-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "completed");
  assert.equal(rows[0]?.userId, "user-a");
});

test("⭐ 隔离：看不到别人的记录", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "roadmap-1", taskId: "task-a", status: "completed", note: null, now: NOW });
  await repo.upsert("user-b", { roadmapId: "roadmap-1", taskId: "task-b", status: "in-progress", note: null, now: NOW });

  const aRows = await repo.listByUser("user-a", "roadmap-1");
  const bRows = await repo.listByUser("user-b", "roadmap-1");

  assert.deepEqual(aRows.map((r) => r.taskId), ["task-a"]);
  assert.deepEqual(bRows.map((r) => r.taskId), ["task-b"]);
  assert.equal(JSON.stringify(aRows).includes("task-b"), false);
});

test("⭐ 隔离：同一任务编号在不同用户名下互不覆盖", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "r", taskId: "same-id", status: "completed", note: "a 的备注", now: NOW });
  await repo.upsert("user-b", { roadmapId: "r", taskId: "same-id", status: "skipped", note: "b 的备注", now: NOW });

  const a = await repo.listByUser("user-a", "r");
  const b = await repo.listByUser("user-b", "r");
  assert.equal(a[0]?.note, "a 的备注");
  assert.equal(a[0]?.status, "completed");
  assert.equal(b[0]?.note, "b 的备注");
  assert.equal(b[0]?.status, "skipped");
});

test("隔离：给不存在的用户查不到任何东西", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "r", taskId: "t", status: "completed", note: null, now: NOW });
  assert.deepEqual(await repo.listByUser("user-nobody", "r"), []);
});

test("隔离：空用户归属被拒绝（读写都拒绝）", async () => {
  const repo = new InMemoryProgressRepository();
  await assert.rejects(() => repo.listByUser("", "r"), (e: unknown) => {
    assertRepositoryError(e, "BAD_REQUEST");
    return true;
  });
  await assert.rejects(
    () => repo.upsert("", { roadmapId: "r", taskId: "t", status: "completed", note: null, now: NOW }),
    (e: unknown) => {
      assertRepositoryError(e, "BAD_REQUEST");
      return true;
    },
  );
});

test("进度：同一用户同一任务重复写入是更新而不是新增", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "r", taskId: "t", status: "in-progress", note: null, now: NOW });
  await repo.upsert("user-a", {
    roadmapId: "r",
    taskId: "t",
    status: "completed",
    note: "改过了",
    now: "2026-09-20T13:00:00.000Z",
  });

  const rows = await repo.listByUser("user-a", "r");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "completed");
  assert.equal(rows[0]?.note, "改过了");
  assert.equal(rows[0]?.updatedAt, "2026-09-20T13:00:00.000Z");
});

test("进度：不同路线之间互不干扰", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "r1", taskId: "t", status: "completed", note: null, now: NOW });
  assert.equal((await repo.listByUser("user-a", "r1")).length, 1);
  assert.equal((await repo.listByUser("user-a", "r2")).length, 0);
});

test("⭐ 返回的是副本：改返回值不会污染存储（C 模块复测踩过的坑）", async () => {
  const repo = new InMemoryProgressRepository();
  await repo.upsert("user-a", { roadmapId: "r", taskId: "t", status: "completed", note: null, now: NOW });

  const first = await repo.listByUser("user-a", "r");
  first[0]!.status = "skipped";
  first[0]!.note = "被外部改掉的";
  first.push({
    userId: "user-a",
    roadmapId: "r",
    taskId: "凭空多出来的",
    status: "completed",
    note: null,
    updatedAt: NOW,
  });

  const second = await repo.listByUser("user-a", "r");
  assert.equal(second.length, 1);
  assert.equal(second[0]?.status, "completed");
  assert.equal(second[0]?.note, null);
});

test("进度：缺少任务标识被拒绝", async () => {
  const repo = new InMemoryProgressRepository();
  await assert.rejects(
    () => repo.upsert("user-a", { roadmapId: "r", taskId: "", status: "completed", note: null, now: NOW }),
    (e: unknown) => {
      assertRepositoryError(e, "BAD_REQUEST");
      return true;
    },
  );
});
