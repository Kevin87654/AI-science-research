/**
 * 进度提示词测试：确保该带的事实都带上了、该有的约束没被删掉。
 * 提示词漂移不会让编译失败，但会让模型开始编日期 —— 所以用测试钉住关键词。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { StudentNode } from "@/contracts";

import { buildReminderPrompt, buildSummaryPrompt } from "./progress-prompts.ts";
import type { ProgressAiInput } from "./progress-advice.ts";

const NODE: StudentNode = {
  id: "n1",
  date: "2026-11-05",
  title: "和导师确认选题方向",
  note: "初步定为 AI 辅助的毕设过程管理。",
  createdAt: "2026-11-05T09:20:00.000Z",
};

const INPUT: ProgressAiInput = {
  studentId: "20220001",
  today: "2026-11-12",
  nodes: [NODE],
};

test("提醒提示词带今天、完整时间轴、学生节点与 JSON 约束", () => {
  const prompt = buildReminderPrompt(INPUT);

  assert.match(prompt, /2026-11-12/);
  assert.match(prompt, /2026年11月13日前/);
  assert.match(prompt, /2027年4月16日 23:59 前/);
  assert.match(prompt, /和导师确认选题方向/);
  assert.match(prompt, /不编造学生没做过的事/);
  assert.match(prompt, /JSON/);
});

test("汇总提示词带姓名、下一个节点、第一人称与 JSON 约束", () => {
  const prompt = buildSummaryPrompt(INPUT, "林知遥");

  assert.match(prompt, /林知遥/);
  assert.match(prompt, /不要写学号/);
  assert.match(prompt, /2026年11月13日前/);
  assert.match(prompt, /第一人称/);
  assert.match(prompt, /只写记录里出现过的事实/);
  assert.match(prompt, /JSON/);
});

test("没有节点时提示词明确写出「还没有记录」", () => {
  const prompt = buildReminderPrompt({ ...INPUT, nodes: [] });
  assert.match(prompt, /还没有记录任何节点/);
});
