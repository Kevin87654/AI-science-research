/**
 * 进度 AI 的纯逻辑测试。
 *
 * 这里守的是"模型输出不可信"和"客户端数据不干净"两道口子：
 * JSON 不完整要返回 null、坏节点要 400、AI 不可用时规则提醒仍要给出可用内容。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { GraduationMilestone, StudentNode } from "@/contracts";

import {
  buildRuleReminder,
  buildRuleSummary,
  parseProgressAiInput,
  parseReminderDraft,
  parseSummaryDraft,
} from "./progress-advice.ts";

const MILESTONES: readonly GraduationMilestone[] = [
  {
    id: "taskbook",
    dateLabel: "2026年11月13日前",
    dueDate: "2026-11-13",
    title: "导师下达《任务书》",
    detail: "",
    materials: ["毕业论文任务书"],
  },
  {
    id: "proposal",
    dateLabel: "2026年12月11日前",
    dueDate: "2026-12-11",
    title: "提交开题报告",
    detail: "",
    materials: ["开题报告"],
  },
];

const NODES: StudentNode[] = [
  {
    id: "n1",
    date: "2026-11-05",
    title: "和导师确认选题方向",
    note: "初步定为 AI 辅助的毕设过程管理。",
    createdAt: "2026-11-05T09:20:00.000Z",
  },
];

test("parseReminderDraft 接受 JSON、代码块和多余前言", () => {
  const direct = parseReminderDraft('{"headline":"进度正常","items":["提醒一","提醒二"]}');
  assert.deepEqual(direct, { headline: "进度正常", items: ["提醒一", "提醒二"] });

  const fenced = parseReminderDraft('```json\n{"headline":"进度正常","items":["提醒一"]}\n```');
  assert.equal(fenced?.items.length, 1);

  assert.equal(parseReminderDraft("不是 JSON"), null);
  assert.equal(parseReminderDraft('{"headline":"","items":["x"]}'), null);
  assert.equal(parseReminderDraft('{"headline":"x","items":[]}'), null);
});

test("parseSummaryDraft 保留正文换行，拒绝空标题/空正文", () => {
  const draft = parseSummaryDraft('{"title":"进度汇报","body":"【已完成】\\n- 读了 3 篇综述"}');
  assert.equal(draft?.title, "进度汇报");
  assert.match(draft?.body ?? "", /【已完成】\n- 读了 3 篇综述/);

  assert.equal(parseSummaryDraft('{"title":"","body":"x"}'), null);
  assert.equal(parseSummaryDraft('{"title":"x","body":""}'), null);
});

test("parseProgressAiInput 接受合法节点，拒绝坏日期/超长/超量", () => {
  const ok = parseProgressAiInput({
    studentId: "20220001",
    today: "2026-11-12",
    nodes: NODES,
  });
  assert.equal(ok?.nodes.length, 1);
  assert.equal(ok?.nodes[0].title, "和导师确认选题方向");

  assert.equal(
    parseProgressAiInput({ studentId: "20220001", today: "2026-02-31", nodes: [] }),
    null,
  );
  assert.equal(
    parseProgressAiInput({
      studentId: "20220001",
      today: "2026-11-12",
      nodes: [{ ...NODES[0], date: "2026-02-31" }],
    }),
    null,
  );
  assert.equal(
    parseProgressAiInput({
      studentId: "20220001",
      today: "2026-11-12",
      nodes: [{ ...NODES[0], title: "字".repeat(41) }],
    }),
    null,
  );
  assert.equal(
    parseProgressAiInput({
      studentId: "20220001",
      today: "2026-11-12",
      nodes: Array.from({ length: 51 }, (_, index) => ({ ...NODES[0], id: `n${index}` })),
    }),
    null,
  );
});

test("buildRuleReminder 无记录时先提示补记录，仍给出下一个节点", () => {
  const reminder = buildRuleReminder({ today: "2026-11-12", nodes: [], milestones: MILESTONES });

  assert.equal(reminder.source, "rule");
  assert.match(reminder.headline, /还没有进度记录/);
  assert.ok(reminder.items.length >= 2 && reminder.items.length <= 4);
  assert.match(reminder.items.join("\n"), /下一个学院节点/);
  assert.match(reminder.items.join("\n"), /任务书/);
});

test("buildRuleReminder 在节点临近时提示还剩几天", () => {
  const reminder = buildRuleReminder({ today: "2026-11-12", nodes: NODES, milestones: MILESTONES });

  assert.match(reminder.headline, /就在眼前/);
  assert.match(reminder.items.join("\n"), /还有 1 天/);
  assert.match(reminder.items.join("\n"), /和导师确认选题方向/);
  assert.ok(reminder.items.length <= 4);
});

test("buildRuleSummary 汇总节点、下一个节点并标注条数", () => {
  const summary = buildRuleSummary({ today: "2026-11-12", nodes: NODES, milestones: MILESTONES });

  assert.equal(summary.source, "rule");
  assert.equal(summary.nodeCount, 1);
  assert.match(summary.title, /2026-11-12/);
  assert.match(summary.body, /【已完成】/);
  assert.match(summary.body, /和导师确认选题方向/);
  assert.match(summary.body, /【对照学院时间轴】/);
  assert.match(summary.body, /任务书/);
});
