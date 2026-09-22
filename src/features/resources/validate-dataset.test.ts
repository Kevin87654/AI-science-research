/**
 * 资料集校验测试（C 负责）。
 *
 * 这些用例模拟的是**有人手改数据**之后会怎样：改坏一条 URL、复制粘贴导致 id 重复、
 * 删掉一条 FAQ 的引用。诉求只有一个 —— 必须在加载时被挡住，
 * 而不是等用户提问时得到一条"看起来有依据"的回答。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { Catalog, Knowledge } from "../../contracts/index.ts";
import { validateDataset } from "./validate-dataset.ts";

const catalog = JSON.parse(
  await readFile(new URL("../../../data/szu-teachers.json", import.meta.url), "utf8"),
) as Catalog;
const knowledge = JSON.parse(
  await readFile(new URL("../../../data/research-faq.json", import.meta.url), "utf8"),
) as Knowledge;

test("真实数据完整：10位教师、12条FAQ、引用闭合", () => {
  assert.equal(catalog.teachers.length, 10);
  assert.equal(knowledge.faqs.length, 12);
  assert.deepEqual(validateDataset(catalog, knowledge), []);
});

test("缺失来源会被校验拒绝", () => {
  const copy = structuredClone(knowledge);
  copy.faqs[0].sourceIds = ["missing"];
  assert.ok(validateDataset(catalog, copy).some((message) => message.includes("引用不存在")));
});

test("篡改、重复ID和危险来源被校验拒绝", () => {
  const copy = structuredClone(catalog);
  copy.teachers[0].source.url = "javascript:alert(1)";
  copy.teachers[1].id = copy.teachers[0].id;

  const errors = validateDataset(copy, knowledge);
  assert.ok(errors.some((message) => message.includes("URL无效")));
  assert.ok(errors.some((message) => message.includes("ID重复")));
});

test("缺数组时给出单一明确错误；空数组按原行为放行", () => {
  assert.deepEqual(validateDataset({}, knowledge), ["缺少 teachers / faqs / sources 数组"]);

  // ⚠️ 这里记录的是**从 demo 继承的行为，本轮的移植刻意没有改**：
  // `[]` 是数组，所以能通过"形状"检查，一个空目录会被判为合格。
  // 是否要把它升级成错误，属于产品决策，留给团队定 —— 见 PR 描述里的说明。
  assert.deepEqual(validateDataset(catalog, { faqs: [], sources: [] }), []);
});

test("未经确认的实时名额会被拒绝 —— 名额不许猜", () => {
  const copy = structuredClone(catalog) as unknown as {
    teachers: Array<{ recruitment: { currentAvailability: string } }>;
  };
  copy.teachers[0].recruitment.currentAvailability = "还有2个名额";

  const errors = validateDataset(copy, knowledge);
  assert.ok(errors.some((message) => message.includes("未经确认的实时名额")));
});
