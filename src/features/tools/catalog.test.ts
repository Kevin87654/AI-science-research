/**
 * 科研工具箱纯函数测试（B 负责）。
 *
 * 盯两件容易做错、用户立刻能感觉到的事：
 * 1. 分类筛选与关键词搜索要准（搜索要命中名称、描述和标签）；
 * 2. 数据校验要拦得住非法链接与非法分类，否则脏数据会直接上页面。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ResearchTool } from "../../contracts/tool.ts";
import { searchTools, validateTools } from "./catalog.ts";

const tools: ResearchTool[] = [
  {
    id: "arxiv",
    name: "arXiv",
    url: "https://arxiv.org",
    category: "paper-library",
    description: "预印本平台",
    access: "free",
    language: "en",
    tags: ["预印本", "AI"],
  },
  {
    id: "jiqizhixin",
    name: "机器之心",
    url: "https://www.jiqizhixin.com",
    category: "frontier-news",
    description: "AI 进展解读",
    access: "free",
    language: "zh",
    tags: ["AI", "资讯"],
  },
];

test("按分类筛选", () => {
  assert.deepEqual(
    searchTools(tools, { category: "paper-library" }).map((tool) => tool.id),
    ["arxiv"],
  );
});

test("关键词搜索命中名称、描述与标签", () => {
  assert.deepEqual(
    searchTools(tools, { query: "AI" }).map((tool) => tool.id).sort(),
    ["arxiv", "jiqizhixin"],
  );
  assert.deepEqual(
    searchTools(tools, { query: "预印本" }).map((tool) => tool.id),
    ["arxiv"],
  );
});

test("空白输入返回全部，顺序稳定", () => {
  assert.deepEqual(
    searchTools(tools).map((tool) => tool.id),
    ["arxiv", "jiqizhixin"],
  );
});

test("合法数据校验通过", () => {
  assert.deepEqual(validateTools({ tools }), []);
});

test("校验拒绝非法链接与非法分类", () => {
  const bad = [
    { id: "x", name: "X", url: "not-a-url", category: "paper-library", description: "d", access: "free", language: "en", tags: [] },
    { id: "y", name: "Y", url: "https://y.com", category: "weird", description: "d", access: "free", language: "en", tags: [] },
  ];
  const errors = validateTools({ tools: bad });
  assert.ok(errors.some((error) => error.includes("url")), "应拦下非法链接");
  assert.ok(errors.some((error) => error.includes("category")), "应拦下非法分类");
});
