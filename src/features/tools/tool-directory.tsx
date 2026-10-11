"use client";

/**
 * 科研工具箱（B 负责）—— 外部科研站点的导航。
 *
 * 定位与教师目录不同：这里**不做背书、不做个性化推荐**，只做「这是什么、怎么用、
 * 免费与否」的客观导航。因此界面简单：按分类筛选 + 关键词搜索 + 外链卡片。
 *
 * 产品红线在这里的落点：链接是编辑整理的公开资源，**不承诺链接永远有效**，
 * `note` 会写清「部分内容需订阅」「未同行评审」这类边界；列表不是「全部」，`scope` 会说明。
 */
import { useMemo, useState } from "react";

import type { ResearchTool, ToolCategory, ToolDirectory } from "@/contracts";
import {
  TOOL_ACCESS_LABELS,
  TOOL_CATEGORY_LABELS,
  TOOL_CATEGORY_ORDER,
  TOOL_LANGUAGE_LABELS,
  searchTools,
} from "./catalog";

function ToolCard({ tool }: { tool: ResearchTool }) {
  return (
    <li className="card tool-card">
      <div className="tool-head">
        <div>
          <h3 className="card-title">{tool.name}</h3>
          <p className="muted small">{tool.description}</p>
        </div>
        <a className="button-ghost" href={tool.url} target="_blank" rel="noreferrer noopener">
          访问网站
        </a>
      </div>

      {tool.tags.length > 0 && (
        <ul className="tag-list">
          {tool.tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <p className="small muted">
        {TOOL_CATEGORY_LABELS[tool.category]} · {TOOL_ACCESS_LABELS[tool.access]} ·{" "}
        {TOOL_LANGUAGE_LABELS[tool.language]}
      </p>

      {tool.note ? <p className="small muted tool-note">{tool.note}</p> : null}
    </li>
  );
}

export function ToolDirectory({ directory }: { directory: ToolDirectory }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "">("");

  const tools = useMemo(
    () => searchTools(directory.tools, { query, category }),
    [directory.tools, query, category],
  );

  return (
    <div className="panel tool-panel">
      <header className="panel-header">
        <div>
          <h1>科研工具箱</h1>
        </div>
      </header>

      <div className="notice notice-warn">
        <p className="small">{directory.notice}</p>
      </div>

      <form className="tool-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="tool-search">
          <span className="visually-hidden">按名称或用途搜索</span>
          <input
            className="note-input"
            type="search"
            value={query}
            placeholder="按名称或用途搜索，例如「论文」「AI」"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="tool-chips">
          <button
            type="button"
            className={category === "" ? "chip chip-active" : "chip"}
            onClick={() => setCategory("")}
          >
            全部
          </button>
          {TOOL_CATEGORY_ORDER.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? "chip chip-active" : "chip"}
              onClick={() => setCategory(category === item ? "" : item)}
            >
              {TOOL_CATEGORY_LABELS[item]}
            </button>
          ))}
        </div>
      </form>

      <p className="small muted" role="status">
        共 {tools.length} 个
        {tools.length === 0 && " · 换个关键词，或清空分类"}
      </p>

      {tools.length === 0 ? (
        <div className="card card-quiet">
          <p className="card-title">没有找到匹配的站点</p>
          <p className="small muted">这里只收录常用站点。可以换成更宽的关键词，或清空筛选条件。</p>
        </div>
      ) : (
        <ul className="tool-list">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </ul>
      )}
    </div>
  );
}
