/**
 * 问答接口入参校验测试（C 负责）。
 *
 * 盯的是三件事：
 * 1. **畸形请求进不来**（不是对象、缺字段、类型不对、超长）—— 否则会白白消耗一次引擎/AI 调用；
 * 2. **正常但内容不当的提问进得来** —— 空问题、超长问题应当由引擎给出可读提示，而不是变成 400；
 * 3. **身份字段被忽略** —— 请求体里塞 `userId` 不报错、也不被采纳（契约铁律 1）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_QUESTION_LENGTH } from "./engine.ts";
import { parseQuestionRequest } from "./request.ts";

test("畸形请求体一律拒绝", () => {
  for (const body of [null, undefined, "s", 42, true, [], {}, { question: 1 }, { question: null }]) {
    assert.equal(parseQuestionRequest(body), null, `应拒绝：${JSON.stringify(body)}`);
  }
});

test("超出长度上限的提问在接口层被拒", () => {
  assert.equal(parseQuestionRequest({ question: "x".repeat(MAX_QUESTION_LENGTH + 1) }), null);
  // 恰好等于上限应当放行 —— 边界只能在一侧。
  assert.equal(parseQuestionRequest({ question: "x".repeat(MAX_QUESTION_LENGTH) })?.length, MAX_QUESTION_LENGTH);
});

test("空问题与纯空白放行，交给引擎给出可读提示", () => {
  // 接口层不把"问了个空"当成畸形请求：它不是协议错误，
  // 而是用户行为，应当得到一句"请先输入一个问题。"而不是 400。
  assert.equal(parseQuestionRequest({ question: "" }), "");
  assert.equal(parseQuestionRequest({ question: "   " }), "   ");
});

test("身份字段被忽略而不是被采纳", () => {
  const parsed = parseQuestionRequest({ question: "有哪些研究知识图谱的老师", userId: "伪造的别人" });
  assert.equal(parsed, "有哪些研究知识图谱的老师");
});

test("多余字段不影响解析", () => {
  assert.equal(parseQuestionRequest({ question: "大一怎么找导师", 随便: 1, nested: { a: 2 } }), "大一怎么找导师");
});
