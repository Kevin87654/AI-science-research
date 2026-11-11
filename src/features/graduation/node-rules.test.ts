/**
 * 学生节点输入的校验测试。
 *
 * 盯住的是"能感觉到的错"：
 * 1. `2026-02-31` 这种形状合法、日期不存在的值必须被挡下（否则时间轴上会多出一条不存在的记录）；
 * 2. 标题只有空格不能算填了；
 * 3. 空备注要落成 `null`，与 `task_progress.note` 的约定一致 —— 界面才不会显示一个空引用。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { NODE_NOTE_MAX, NODE_TITLE_MAX, validateNodeDraft } from "./node-rules.ts";

test("合法输入通过，并去掉首尾空白", () => {
  const result = validateNodeDraft({ date: " 2026-11-15 ", title: "  写完开题报告  ", note: "  导师看过一版  " });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, { date: "2026-11-15", title: "写完开题报告", note: "导师看过一版" });
});

test("空备注落成 null，而不是空字符串", () => {
  const result = validateNodeDraft({ date: "2026-11-15", title: "写周报", note: "   " });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.note, null);
});

test("形状对但不存在的日期被拒绝", () => {
  const result = validateNodeDraft({ date: "2026-02-31", title: "假的日期", note: "" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, "date");
});

test("日期格式不对被拒绝", () => {
  for (const date of ["", "2026/11/15", "2026-1-5", "26-11-15"]) {
    const result = validateNodeDraft({ date, title: "标题", note: "" });
    assert.equal(result.ok, false, `应拒绝 ${JSON.stringify(date)}`);
  }
});

test("年份超出范围被拒绝", () => {
  const result = validateNodeDraft({ date: "2019-12-31", title: "太早", note: "" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.field, "date");
});

test("空标题、纯空格标题被拒绝", () => {
  for (const title of ["", "   ", "\n\t"]) {
    const result = validateNodeDraft({ date: "2026-11-15", title, note: "" });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.field, "title");
  }
});

test("标题与备注的长度上限按字符数计算", () => {
  const longTitle = "标".repeat(NODE_TITLE_MAX + 1);
  const titleResult = validateNodeDraft({ date: "2026-11-15", title: longTitle, note: "" });
  assert.equal(titleResult.ok, false);

  const longNote = "注".repeat(NODE_NOTE_MAX + 1);
  const noteResult = validateNodeDraft({ date: "2026-11-15", title: "标题", note: longNote });
  assert.equal(noteResult.ok, false);
  if (noteResult.ok) return;
  assert.equal(noteResult.field, "note");

  // 正好等于上限时应当通过（边界值最容易写错成 >= / >）
  const boundary = validateNodeDraft({
    date: "2026-11-15",
    title: "标".repeat(NODE_TITLE_MAX),
    note: "注".repeat(NODE_NOTE_MAX),
  });
  assert.equal(boundary.ok, true);
});
