/**
 * 时间轴日期计算的测试。
 *
 * 这些函数看着小，但错一天就直接影响"还有几天"的显示。
 * 特意覆盖了跨月、2 月、以及"就是今天 / 已过去"两个边界。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  daysBetween,
  describeDue,
  formatIsoDate,
  latestByDate,
  parseIsoDate,
  pickNextMilestone,
  toLocalIsoDate,
} from "./timeline-meta.ts";

test("parseIsoDate 接受真实日期、拒绝不存在的日期", () => {
  assert.deepEqual(parseIsoDate("2026-11-11"), { year: 2026, month: 11, day: 11 });
  assert.equal(parseIsoDate("2026-02-29"), null); // 2026 不是闰年
  assert.deepEqual(parseIsoDate("2028-02-29"), { year: 2028, month: 2, day: 29 });
  assert.equal(parseIsoDate("2026-13-01"), null);
  assert.equal(parseIsoDate("20261111"), null);
});

test("formatIsoDate 输出中文日期，坏输入原样返回", () => {
  assert.equal(formatIsoDate("2026-11-15"), "2026年11月15日");
  assert.equal(formatIsoDate("2027-04-01"), "2027年4月1日");
  assert.equal(formatIsoDate("不是日期"), "不是日期");
});

test("daysBetween 跨月、跨年都算对", () => {
  assert.equal(daysBetween("2026-11-10", "2026-11-11"), 1);
  assert.equal(daysBetween("2026-11-11", "2026-11-11"), 0);
  assert.equal(daysBetween("2026-11-11", "2026-11-10"), -1);
  assert.equal(daysBetween("2026-12-11", "2027-01-11"), 31);
  assert.equal(daysBetween("2026-11-10", "2027-04-01"), 142);
  assert.equal(daysBetween("坏", "2027-01-01"), null);
});

test("describeDue 的三种状态与文案", () => {
  assert.deepEqual(describeDue("2026-11-20", "2026-11-10"), { days: 10, state: "upcoming", label: "还有 10 天" });
  assert.deepEqual(describeDue("2026-11-10", "2026-11-10"), { days: 0, state: "today", label: "就是今天" });
  assert.deepEqual(describeDue("2026-11-07", "2026-11-10"), { days: -3, state: "overdue", label: "已过去 3 天" });
  assert.equal(describeDue("坏", "2026-11-10").label, "日期待定");
});

test("toLocalIsoDate 用本地时区补零", () => {
  assert.equal(toLocalIsoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(toLocalIsoDate(new Date(2026, 10, 30)), "2026-11-30");
});

test("pickNextMilestone 只认具体日期，跳过已过去与无日期的节点", () => {
  const milestones = [
    { id: "past", dueDate: "2026-11-01" },
    { id: "undated", dueDate: null },
    { id: "late", dueDate: "2027-04-01" },
    { id: "soon", dueDate: "2026-11-11" },
  ];
  assert.equal(pickNextMilestone(milestones, "2026-11-10")?.id, "soon");

  // 全部过期时返回 null，而不是把最后一个节点当成"下一个"
  assert.equal(pickNextMilestone(milestones, "2027-05-01"), null);

  // 只有无日期节点时也返回 null
  assert.equal(pickNextMilestone([{ id: "undated", dueDate: null }], "2026-11-10"), null);
});

test("latestByDate 取日期最晚的一条", () => {
  const nodes = [{ date: "2026-11-05" }, { date: "2026-12-01" }, { date: "2026-11-20" }];
  assert.equal(latestByDate(nodes)?.date, "2026-12-01");
  assert.equal(latestByDate([]), null);
});
