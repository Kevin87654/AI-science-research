/**
 * 问答端口测试（C 负责）。
 *
 * 迁自 C 模块 demo 的 `tests/provider.test.mjs`，并补上本轮修复的**返回数组污染**回归用例。
 *
 * 这里的两类断言性质不同，都保留：
 * - **入参隔离**：provider 建好之后，调用方再怎么折腾自己那份数据都不该影响它；
 * - **出参隔离**：调用方改返回值，不能影响下一次调用 —— 这是本轮新补的（修复 #2）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { Catalog, Knowledge } from "../../contracts/index.ts";
import { createCuratedProvider } from "./provider.ts";

const catalog = JSON.parse(
  await readFile(new URL("../../../data/szu-teachers.json", import.meta.url), "utf8"),
) as Catalog;
const knowledge = JSON.parse(
  await readFile(new URL("../../../data/research-faq.json", import.meta.url), "utf8"),
) as Knowledge;

test("异步问答端口无需网络且不受调用方修改数据影响", async () => {
  const copy = structuredClone(catalog);
  const provider = createCuratedProvider(copy, knowledge);

  // 建好之后把调用方自己那份数据清空 —— provider 用的是内部快照，结果不应变化。
  copy.teachers.length = 0;

  assert.equal(provider.kind, "curated-rules");
  assert.match((await provider.answer("姚俊梅的邮箱")).answer, /yaojunmei@szu.edu.cn/);
});

test("不完整可信库无法创建正式问答实例", () => {
  const copy = structuredClone(knowledge);
  copy.faqs[0].sourceIds = ["missing"];
  assert.throws(() => createCuratedProvider(catalog, copy), /Invalid trusted dataset/);
});

test("修改第一次返回的 actions 不污染第二次回答（本轮修复 #2）", async () => {
  const provider = createCuratedProvider(catalog, knowledge);
  const faq = knowledge.faqs[0];

  const first = await provider.answer(faq.question);
  const expected = [...first.actions];
  assert.ok(expected.length > 0);

  // 模拟调用方"顺手"往返回值里加一项 —— 原实现会把这一项写进内部数据。
  first.actions.push("调用方偷偷加的一条");

  const second = await provider.answer(faq.question);
  assert.deepEqual(second.actions, expected);
  assert.ok(!second.actions.includes("调用方偷偷加的一条"));
});

test("引用对象也被隔离：改 citations 里的字段不影响后续回答（本轮修复 #2）", async () => {
  const provider = createCuratedProvider(catalog, knowledge);
  const faq = knowledge.faqs[0];

  const first = await provider.answer(faq.question);
  assert.ok(first.citations.length > 0, "这条 FAQ 应当带引用，否则用例失去意义");
  const originalTitle = first.citations[0].title;

  first.citations[0].title = "被篡改的标题";
  first.teacherIds.push("fake-teacher-id");

  const second = await provider.answer(faq.question);
  assert.equal(second.citations[0].title, originalTitle);
  assert.ok(!second.teacherIds.includes("fake-teacher-id"));
});
