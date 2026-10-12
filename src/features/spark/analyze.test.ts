/**
 * 「奇思妙想」与「入门前置路线」纯函数测试（B 负责）。
 *
 * 针对的是"结论对不对"：方向 id 只认固定目录、非法项丢弃、核心输出为空时不放水。
 * 这些是最容易被改坏、又最难在手工点页面时发现的一层。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { toInterestTag } from "../interest/directions.ts";
import { parseEntryRoute, parseEntryRouteRequest } from "../roadmap/entry-route.ts";
import { parseJsonObject, parseSparkAnalysis } from "./analyze.ts";
import { parseSparkRequest } from "./request.ts";
import { collectInterestTags } from "./store.ts";

const NOW = "2026-10-11T12:00:00+08:00";

/* ------------------------------------------------------------------ */
/* parseSparkAnalysis                                                  */
/* ------------------------------------------------------------------ */

test("parseSparkAnalysis：合法输出被正确解析，非法方向 id 被丢弃", () => {
  const modelText = JSON.stringify({
    highlights: ["对重复的小事有耐心", "会从自动化的角度想问题"],
    interestIds: ["it-ai", "it-hci", "it-bogus"],
    rationale: "反复出现自动整理、识别，最接近人工智能方向。",
    response: "这已经是一个具体的 AI 应用场景了。",
  });

  const result = parseSparkAnalysis({ modelText, id: "a1", text: "原文", generatedAt: NOW });
  assert.ok(result);
  assert.equal(result.text, "原文");
  assert.deepEqual(
    result.interests.map((tag) => tag.id),
    ["it-ai", "it-hci"],
  );
  assert.equal(result.highlights.length, 2);
  assert.equal(result.response, "这已经是一个具体的 AI 应用场景了。");
});

test("parseSparkAnalysis：模型套了 ```json 代码块也能解析", () => {
  const modelText = '```json\n{"highlights":["a"],"interestIds":["it-ai"],"rationale":"r","response":""}\n```';
  const result = parseSparkAnalysis({ modelText, id: "a2", text: "x", generatedAt: NOW });
  assert.ok(result);
  assert.deepEqual(result.interests.map((tag) => tag.id), ["it-ai"]);
});

test("parseSparkAnalysis：不是 JSON 时返回 null", () => {
  assert.equal(parseSparkAnalysis({ modelText: "这不是 JSON", id: "a", text: "x", generatedAt: NOW }), null);
});

test("parseSparkAnalysis：亮点与方向全空时返回 null（不放水）", () => {
  const modelText = JSON.stringify({ highlights: [], interestIds: [], rationale: "", response: "" });
  assert.equal(parseSparkAnalysis({ modelText, id: "a", text: "x", generatedAt: NOW }), null);
});

test("parseSparkAnalysis：方向全非法但亮点还在时，仍返回结果（方向为空）", () => {
  const modelText = JSON.stringify({ highlights: ["有耐心"], interestIds: ["it-nope"], rationale: "", response: "" });
  const result = parseSparkAnalysis({ modelText, id: "a", text: "x", generatedAt: NOW });
  assert.ok(result);
  assert.equal(result.interests.length, 0);
  assert.deepEqual(result.highlights, ["有耐心"]);
});

test("parseSparkAnalysis：rationale 缺失时用兜底文案", () => {
  const modelText = JSON.stringify({ highlights: ["a"], interestIds: ["it-ai"], response: "" });
  const result = parseSparkAnalysis({ modelText, id: "a", text: "x", generatedAt: NOW });
  assert.ok(result);
  assert.ok(result.rationale.length > 0);
});

/* ------------------------------------------------------------------ */
/* parseJsonObject 辅助                                               */
/* ------------------------------------------------------------------ */

test("parseJsonObject：截取最外层花括号", () => {
  assert.deepEqual(parseJsonObject('前言 {"a": 1} 后语'), { a: 1 });
  assert.equal(parseJsonObject("没有花括号"), null);
});

/* ------------------------------------------------------------------ */
/* parseSparkRequest                                                  */
/* ------------------------------------------------------------------ */

test("parseSparkRequest：返回清洗后的文本", () => {
  assert.equal(parseSparkRequest({ text: "  想法  " }), "想法");
});

test("parseSparkRequest：空输入 / 非字符串 / 超长 / 缺字段都返回 null", () => {
  assert.equal(parseSparkRequest({ text: "   " }), null);
  assert.equal(parseSparkRequest({ text: 123 }), null);
  assert.equal(parseSparkRequest({}), null);
  assert.equal(parseSparkRequest("不是对象"), null);
  assert.equal(parseSparkRequest({ text: "x".repeat(2001) }), null);
});

/* ------------------------------------------------------------------ */
/* parseEntryRoute                                                    */
/* ------------------------------------------------------------------ */

test("parseEntryRoute：合法输出被解析，direction 由调用方传入不被采信", () => {
  const direction = toInterestTag("it-ai");
  assert.ok(direction);
  const modelText = JSON.stringify({
    overview: "研究如何让机器从数据里学习。",
    hotspots: [{ title: "大模型", why: "当前最热" }],
    milestones: [{ title: "AlexNet (2012)", why: "深度学习转折点" }],
    researchers: [{ title: "Geoffrey Hinton", why: "深度学习先驱" }],
    entryPapers: [{ title: "Attention Is All You Need", why: "Transformer 源头" }],
  });

  const result = parseEntryRoute({ modelText, direction, id: "r1", generatedAt: NOW });
  assert.ok(result);
  assert.equal(result.direction.id, "it-ai");
  assert.equal(result.hotspots.length, 1);
  assert.equal(result.milestones.length, 1);
  assert.equal(result.researchers.length, 1);
  assert.equal(result.entryPapers.length, 1);
});

test("parseEntryRoute：非法条目（缺 title）被丢弃", () => {
  const direction = toInterestTag("it-ai");
  assert.ok(direction);
  const modelText = JSON.stringify({
    overview: "o",
    hotspots: [{ title: "ok", why: "w" }, { why: "缺 title" }],
    milestones: [{ title: "m", why: "w" }],
    researchers: [],
    entryPapers: [],
  });

  const result = parseEntryRoute({ modelText, direction, id: "r", generatedAt: NOW });
  assert.ok(result);
  assert.equal(result.hotspots.length, 1);
});

test("parseEntryRoute：合计条目不足 2 个时返回 null", () => {
  const direction = toInterestTag("it-ai");
  assert.ok(direction);
  const modelText = JSON.stringify({
    overview: "o",
    hotspots: [{ title: "only", why: "w" }],
    milestones: [],
    researchers: [],
    entryPapers: [],
  });
  assert.equal(parseEntryRoute({ modelText, direction, id: "r", generatedAt: NOW }), null);
});

test("parseEntryRouteRequest：返回方向 id，畸形返回 null", () => {
  assert.equal(parseEntryRouteRequest({ directionId: "it-ai" }), "it-ai");
  assert.equal(parseEntryRouteRequest({ directionId: "" }), null);
  assert.equal(parseEntryRouteRequest({ directionId: 123 }), null);
  assert.equal(parseEntryRouteRequest(null), null);
});

/* ------------------------------------------------------------------ */
/* collectInterestTags（方向合并）                                     */
/* ------------------------------------------------------------------ */

test("collectInterestTags：画像在前、奇思妙想在后，按 id 去重", () => {
  const profileInterests = [toInterestTag("it-ai")!, toInterestTag("it-data")!];
  const sparks = [
    {
      schemaVersion: "1.0.0",
      id: "s1",
      text: "a",
      createdAt: NOW,
      analysis: {
        schemaVersion: "1.0.0",
        id: "sa1",
        text: "a",
        highlights: ["x"],
        interests: [toInterestTag("it-ai")!, toInterestTag("it-hci")!],
        rationale: "r",
        response: null,
        generatedAt: NOW,
      },
    },
    {
      schemaVersion: "1.0.0",
      id: "s2",
      text: "b",
      createdAt: NOW,
      analysis: null,
    },
  ];

  const result = collectInterestTags(profileInterests, sparks as never);
  assert.deepEqual(
    result.map((tag) => tag.id),
    ["it-ai", "it-data", "it-hci"],
  );
});

test("collectInterestTags：手动补充追加在尾部，已出现的方向不重复占位", () => {
  const profileInterests = [toInterestTag("it-ai")!];
  const manual = [
    { id: "it-security", label: "网络安全", source: "user-input" as const },
    // 与画像重复：不应在尾部再出现一次
    { id: "it-ai", label: "人工智能", source: "user-input" as const },
    { id: "it-bio", label: "生物医学", source: "user-input" as const },
  ];

  const result = collectInterestTags(profileInterests, [], manual);
  assert.deepEqual(
    result.map((tag) => tag.id),
    ["it-ai", "it-security", "it-bio"],
  );
  // 画像原有的标签保持原对象（source 不被手动补充覆盖）
  assert.equal(result[0].source, "derived");
});
