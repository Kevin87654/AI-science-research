/**
 * 问答端口测试（C 负责）。
 *
 * 三类断言：
 * - **入参隔离**：provider 建好后，调用方怎么折腾自己那份数据都不该影响它；
 * - **出参隔离**：调用方改返回值，不能影响下一次调用（本轮修复 #2）；
 * - **降级标注**：AI 挂掉回落到规则时，`decidedBy` 必须变成 `rules` ——
 *   否则一条规则回答会被标成"模型生成"，而契约里写死了两者必须可区分。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { Answer, Catalog, Knowledge } from "../../contracts/index.ts";
import { createAiFirstProvider, createCuratedProvider } from "./provider.ts";

const catalog = JSON.parse(
  await readFile(new URL("../../../data/szu-teachers.json", import.meta.url), "utf8"),
) as Catalog;
const knowledge = JSON.parse(
  await readFile(new URL("../../../data/research-faq.json", import.meta.url), "utf8"),
) as Knowledge;

function fakeAnswer(text: string): Answer {
  return {
    mode: "curated",
    status: "limited",
    heading: "模型给的答复",
    answer: text,
    actions: ["看一眼官方页面。"],
    citations: [],
    teacherIds: [],
    limitation: "由模型组织。",
    provenance: "测试用假回答。",
  };
}

test("异步问答端口无需网络且不受调用方修改数据影响", async () => {
  const copy = structuredClone(catalog);
  const provider = createCuratedProvider(copy, knowledge);

  // 建好之后把调用方自己那份数据清空 —— provider 用的是内部快照，结果不应变化。
  copy.teachers.length = 0;

  assert.equal(provider.kind, "curated-rules");
  const result = await provider.answer("姚俊梅的邮箱");
  assert.match(result.answer.answer, /yaojunmei@szu.edu.cn/);
  assert.equal(result.decidedBy, "rules");
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
  const expected = [...first.answer.actions];
  assert.ok(expected.length > 0);

  // 模拟调用方"顺手"往返回值里加一项 —— 原实现会把这一项写进内部数据。
  first.answer.actions.push("调用方偷偷加的一条");

  const second = await provider.answer(faq.question);
  assert.deepEqual(second.answer.actions, expected);
  assert.ok(!second.answer.actions.includes("调用方偷偷加的一条"));
});

test("引用对象也被隔离：改 citations 里的字段不影响后续回答（本轮修复 #2）", async () => {
  const provider = createCuratedProvider(catalog, knowledge);
  const faq = knowledge.faqs[0];

  const first = await provider.answer(faq.question);
  assert.ok(first.answer.citations.length > 0, "这条 FAQ 应当带引用，否则用例失去意义");
  const originalTitle = first.answer.citations[0].title;

  first.answer.citations[0].title = "被篡改的标题";
  first.answer.teacherIds.push("fake-teacher-id");

  const second = await provider.answer(faq.question);
  assert.equal(second.answer.citations[0].title, originalTitle);
  assert.ok(!second.answer.teacherIds.includes("fake-teacher-id"));
});

test("AI 成功时 decidedBy 为 ai", async () => {
  const provider = createAiFirstProvider({
    ai: async () => fakeAnswer("模型答的。"),
    fallback: createCuratedProvider(catalog, knowledge),
  });

  const result = await provider.answer("深大有哪些研究知识图谱的老师？");
  assert.equal(provider.kind, "codebuddy-ai");
  assert.equal(result.decidedBy, "ai");
  assert.equal(result.answer.answer, "模型答的。");
});

test("AI 返回 null（证据不足/结构不过/超时）→ 回落规则，且标注为 rules", async () => {
  let called = 0;
  const provider = createAiFirstProvider({
    ai: async () => {
      called += 1;
      return null;
    },
    fallback: createCuratedProvider(catalog, knowledge),
  });

  const result = await provider.answer("姚俊梅的邮箱是什么");
  assert.equal(called, 1);
  // ⭐ 这一条是重点：链路 kind 是 codebuddy-ai，但这条回答是规则给的，
  //    decidedBy 必须如实写 rules，否则界面会把规则回答标成"模型生成"。
  assert.equal(provider.kind, "codebuddy-ai");
  assert.equal(result.decidedBy, "rules");
  assert.match(result.answer.answer, /yaojunmei@szu.edu.cn/);
});

test("AI 抛异常 → 回落规则，不让异常冒到用户面前", async () => {
  const provider = createAiFirstProvider({
    ai: async () => {
      throw new Error("模拟上游挂了");
    },
    fallback: createCuratedProvider(catalog, knowledge),
  });

  const result = await provider.answer("姚俊梅的邮箱是什么");
  assert.equal(result.decidedBy, "rules");
  assert.match(result.answer.answer, /yaojunmei@szu.edu.cn/);
});

test("AI 成功也要过深拷贝：改返回值不影响下一次", async () => {
  const provider = createAiFirstProvider({
    ai: async () => fakeAnswer("模型答的。"),
    fallback: createCuratedProvider(catalog, knowledge),
  });

  const first = await provider.answer("随便问一句");
  first.answer.actions.push("调用方偷偷加的一条");

  const second = await provider.answer("随便问一句");
  assert.ok(!second.answer.actions.includes("调用方偷偷加的一条"));
});
