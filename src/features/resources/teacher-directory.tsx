"use client";

/**
 * 教师资料目录（C 负责）—— 检索、筛选、详情、来源展示。
 *
 * ## 三条产品红线在这页上的落点
 *
 * 1. **名额不猜。** 任何一位教师都不显示"还有几个名额"，只显示官网原话的概括
 *    与"须向本人确认"的提示。`recruitment.currentAvailability` 在数据层就恒为 `unknown`。
 * 2. **来源可追溯。** 详情里必须能看到来源标题、链接、**我们核对页面的日期**，
 *    并且明确区分"我们什么时候看的"和"页面什么时候更新的"（后者未知就是未知）。
 * 3. **标签匹配不是评价。** 命中理由必须写明"兴趣 X 与官方方向标签对应"，
 *    并附上免责说明；不做优劣排序、不给出录取概率。
 *
 * ## 与 B 的联动（本轮已接）
 *
 * 页头读 B 的本地画像（`useLocalFlow`），把他的兴趣标签作为检索输入 ——
 * 走的就是契约里约定的那条路：`Profile.interests[].label` → `SearchOptions.interests`。
 * 用户可以关掉这个联动，回到纯手动的检索。
 */
import { useMemo, useState } from "react";

import type { Catalog, Match } from "@/contracts";
import { useIsClient, useLocalFlow } from "@/features/shared/use-local-flow";
import { allDirections, searchTeachers, sourceFreshness } from "./catalog";

/** 命中的兴趣标签在卡片上高亮，让人一眼看出"为什么推荐给我"。 */
function TeacherCard({
  match,
  open,
  onToggle,
}: {
  match: Match;
  open: boolean;
  onToggle: () => void;
}) {
  const { teacher, matchedTags, reasons, disclaimer } = match;
  const source = teacher.source;

  return (
    <li className="card teacher-card">
      <div className="teacher-head">
        <div>
          <h3 className="card-title">
            {teacher.name}
            <span className="teacher-meta">
              {teacher.college}
              {teacher.title ? ` · ${teacher.title}` : ""}
            </span>
          </h3>
          <p className="muted small teacher-summary">{teacher.summary}</p>
        </div>
        <button
          type="button"
          className="button-ghost"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`teacher-detail-${teacher.id}`}
        >
          {open ? "收起" : "查看详情"}
        </button>
      </div>

      {teacher.directions.length > 0 && (
        <ul className="tag-list teacher-tags">
          {teacher.directions.map((tag) => (
            <li key={tag} className={matchedTags.includes(tag) ? "tag tag-hit" : "tag"}>
              {tag}
            </li>
          ))}
        </ul>
      )}

      {matchedTags.length > 0 && (
        <p className="teacher-reason small">
          {reasons.join(" ")}
          <span className="muted"> {disclaimer}</span>
        </p>
      )}

      <p className="small muted teacher-recruit">
        本科生参与：{teacher.recruitment.note}
      </p>

      {open && (
        <div className="teacher-detail" id={`teacher-detail-${teacher.id}`}>
          <dl className="teacher-facts">
            <div>
              <dt>所属单位</dt>
              <dd>{teacher.researchUnit}</dd>
            </div>
            <div>
              <dt>公开邮箱</dt>
              <dd>{teacher.publicEmail ?? "官网未公开"}</dd>
            </div>
            <div>
              <dt>官网招募说明</dt>
              <dd>{teacher.recruitment.status}</dd>
            </div>
          </dl>

          {teacher.representativeWorks.length > 0 && (
            <>
              <h4 className="teacher-subtitle">代表性成果</h4>
              <ul className="bullets small">
                {teacher.representativeWorks.map((work) => (
                  <li key={`${work.title}-${work.year}`}>
                    {work.title}（{work.venue}，{work.year}）
                  </li>
                ))}
              </ul>
            </>
          )}

          {teacher.editorial.suggestedMajors.length > 0 && (
            <>
              <h4 className="teacher-subtitle">建议专业（产品编辑建议，非招生条件）</h4>
              <ul className="tag-list">
                {teacher.editorial.suggestedMajors.map((major) => (
                  <li key={major} className="tag">
                    {major}
                  </li>
                ))}
              </ul>
            </>
          )}

          {teacher.pendingConfirmation.length > 0 && (
            <div className="notice notice-warn teacher-pending">
              <div>
                <strong className="small">联系前建议自行核实</strong>
                <ul className="bullets small">
                  {teacher.pendingConfirmation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="teacher-source">
            <h4 className="teacher-subtitle">来源</h4>
            <p className="small">
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title}
              </a>
            </p>
            <p className="small muted">
              {source.publisher} · 我们核对页面的日期：{source.checkedAt}
              {source.pageUpdatedAt
                ? ` · 页面自身更新日期：${source.pageUpdatedAt}`
                : " · 页面自身更新日期：官网未标明"}
            </p>
            <p className="small muted">{source.evidenceSummary}</p>
            <p className="small muted">{sourceFreshness(source)}</p>
          </div>
        </div>
      )}
    </li>
  );
}

export function TeacherDirectory({ catalog }: { catalog: Catalog }) {
  const isClient = useIsClient();
  const flow = useLocalFlow();

  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("");
  const [undergraduateOnly, setUndergraduateOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [linkProfile, setLinkProfile] = useState(true);

  const directions = useMemo(() => allDirections(catalog.teachers), [catalog.teachers]);

  /** B 的画像兴趣 → C 的检索输入。这是契约里约定的唯一联动入口。 */
  const profileInterests = useMemo(
    () => (flow?.profile.interests ?? []).map((tag) => tag.label),
    [flow],
  );
  /**
   * 关掉联动时要把兴趣置空，但**不能每次渲染都新建一个 `[]`** ——
   * 那会让下面的 `useMemo` 依赖每帧都变，筛选结果反复重算（ESLint 也会报）。
   */
  const interests = useMemo(() => (linkProfile ? profileInterests : []), [linkProfile, profileInterests]);

  const matches = useMemo(
    () => searchTeachers(catalog.teachers, { query, direction, undergraduateOnly, interests }),
    [catalog.teachers, query, direction, undergraduateOnly, interests],
  );

  const personalised = interests.length > 0 && matches.some((match) => match.matchedTags.length > 0);

  return (
    <div className="panel teacher-panel">
      <header className="panel-header">
        <div>
          <h1>教师公开资料</h1>
          <p className="lead">{catalog.scope}</p>
        </div>
        {flow?.isDemo && <span className="badge badge-demo">演示数据</span>}
      </header>

      <div className="notice notice-warn">
        <p className="small">{catalog.notice}</p>
      </div>

      {isClient && profileInterests.length > 0 && (
        <div className="notice teacher-link-notice">
          <p className="small">
            已从你的科研画像读到 {profileInterests.length} 个兴趣方向
            {personalised ? "，命中的方向已在下方高亮。" : "。"}
          </p>
          <button type="button" className="button-ghost" onClick={() => setLinkProfile((on) => !on)}>
            {linkProfile ? "不看画像，纯手动筛选" : "按我的画像筛选"}
          </button>
        </div>
      )}

      <form className="teacher-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="teacher-search">
          <span className="visually-hidden">按姓名或研究方向搜索</span>
          <input
            className="note-input"
            type="search"
            value={query}
            placeholder="按姓名或研究方向搜索，例如「知识图谱」「姚俊梅」"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="teacher-chips">
          <button
            type="button"
            className={direction === "" ? "chip chip-active" : "chip"}
            onClick={() => setDirection("")}
          >
            全部方向
          </button>
          {directions.map((item) => (
            <button
              key={item}
              type="button"
              className={direction === item ? "chip chip-active" : "chip"}
              onClick={() => setDirection(direction === item ? "" : item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="teacher-toggle small">
          <input
            type="checkbox"
            checked={undergraduateOnly}
            onChange={(event) => setUndergraduateOnly(event.target.checked)}
          />
          只看官网明确提到欢迎本科生的
        </label>
      </form>

      <p className="small muted" role="status">
        共 {matches.length} 位
        {matches.length === 0 && " · 换个关键词，或清空筛选条件"}
      </p>

      {matches.length === 0 ? (
        <div className="card card-quiet">
          <p className="card-title">没有找到匹配的教师</p>
          <p className="small muted">
            这里只收录首批样本。检索不到不等于全校没有 —— 可以换成更宽的方向词，或清空筛选条件。
          </p>
        </div>
      ) : (
        <ul className="teacher-list">
          {matches.map((match) => (
            <TeacherCard
              key={match.teacher.id}
              match={match}
              open={openId === match.teacher.id}
              onToggle={() => setOpenId(openId === match.teacher.id ? null : match.teacher.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
