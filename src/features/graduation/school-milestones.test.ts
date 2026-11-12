/**
 * 学院时间轴的数据测试。
 *
 * 这张表是学生排进度的唯一依据，口径错了比代码写错更难发现。
 * 这里守住三件小事：id 不重复、有具体日期的节点按时间递增、dueDate 都是真实存在的日期。
 * `dateLabel` 不在这里校验 —— 它允许「大概」「预计」「寒假」这类非标准写法。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { SCHOOL_MILESTONES } from "./school-milestones.ts";
import { parseIsoDate } from "./timeline-meta.ts";

test("学院节点 id 不重复，标题与说明不为空", () => {
  const ids = SCHOOL_MILESTONES.map((milestone) => milestone.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const milestone of SCHOOL_MILESTONES) {
    assert.ok(milestone.title.trim().length > 0, `${milestone.id} 缺标题`);
    assert.ok(milestone.detail.trim().length > 0, `${milestone.id} 缺说明`);
  }
});

test("学院节点的具体日期合法，且按时间递增", () => {
  let previous = "";

  for (const milestone of SCHOOL_MILESTONES) {
    if (!milestone.dueDate) continue;
    assert.ok(parseIsoDate(milestone.dueDate), `${milestone.id} 的 dueDate 不合法：${milestone.dueDate}`);
    assert.ok(milestone.dueDate > previous, `${milestone.id} 的日期没有递增：${milestone.dueDate} <= ${previous}`);
    previous = milestone.dueDate;
  }
});

test("关键硬截止日与学院 2027 届工作安排一致", () => {
  const byId = new Map(SCHOOL_MILESTONES.map((milestone) => [milestone.id, milestone]));

  assert.equal(byId.get("proposal")?.dueDate, "2026-12-11");
  assert.equal(byId.get("submission")?.dueDate, "2027-04-16");
  assert.equal(byId.get("archive")?.dueDate, "2027-04-30");
});
