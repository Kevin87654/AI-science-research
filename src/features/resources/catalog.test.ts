/**
 * 校内资源检索测试（C 负责）。
 *
 * 迁自 C 模块 demo 的 `tests/engine.test.mjs`，行为断言原样保留 ——
 * 这些用例盯的不是"函数能跑"，而是几条已经写进 PRD 的产品红线：
 * **名额不许猜、学院不许串、本科生说明只认官网原话、兴趣匹配不给职称加分**。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { Catalog } from "../../contracts/index.ts";
import { allDirections, matchInterests, searchTeachers, sourceFreshness } from "./catalog.ts";

const catalog = JSON.parse(
  await readFile(new URL("../../../data/szu-teachers.json", import.meta.url), "utf8"),
) as Catalog;

test("按姓名与方向组合搜索，空白输入返回全部", () => {
  assert.equal(searchTeachers(catalog.teachers, { query: "张毅 视觉" }).length, 1);
  assert.equal(searchTeachers(catalog.teachers, { query: "   " }).length, 10);
  assert.equal(searchTeachers(catalog.teachers, { query: "不存在的教师" }).length, 0);
});

test("方向别名大小写可检索，学院筛选不会伪造跨院资源", () => {
  assert.equal(searchTeachers(catalog.teachers, { direction: "IoT" })[0].teacher.name, "姚俊梅");
  assert.ok(searchTeachers(catalog.teachers, { query: "AI" }).length > 0);
  assert.equal(searchTeachers(catalog.teachers, { college: "法学院" }).length, 0);
});

test("本科生说明只包含官网明确提及的两人，名额依旧未知", () => {
  const rows = searchTeachers(catalog.teachers, { undergraduateOnly: true });
  assert.deepEqual(
    rows.map((row) => row.teacher.name).sort(),
    ["姚俊梅", "柴合言"].sort(),
  );
  for (const row of rows) {
    assert.equal(row.teacher.recruitment.currentAvailability, "unknown");
  }
});

test("兴趣命中有理由且去重，不拿职称算分", () => {
  const teacher = catalog.teachers.find((item) => item.name === "姚俊梅");
  assert.ok(teacher);

  // 「IoT」与「物联网」是同一个方向的两种写法，去重后只算一次。
  assert.deepEqual(matchInterests(teacher, ["IoT", "物联网"]).matchedTags, ["物联网"]);
  // 没有交集时不给理由，避免界面上出现无依据的推荐。
  assert.equal(matchInterests(teacher, ["法学"]).reasons.length, 0);
});

test("方向列表按中文排序且去重", () => {
  const directions = allDirections(catalog.teachers);
  assert.equal(new Set(directions).size, directions.length);
  assert.deepEqual(directions, [...directions].sort((a, b) => a.localeCompare(b, "zh-CN")));
});

test("核验新鲜度不冒充网页更新时间", () => {
  const source = catalog.teachers[0].source;
  assert.match(sourceFreshness(source, "2027-01-01"), /超过90天/);
  assert.match(sourceFreshness(source, "2026-09-19"), /名额仍需确认/);
  assert.match(sourceFreshness(source, "2026-09-18"), /异常/);
  // 页面自身的更新日期未知时必须留空，不能用"我们查阅的日期"顶替。
  assert.equal(source.pageUpdatedAt, null);
});
