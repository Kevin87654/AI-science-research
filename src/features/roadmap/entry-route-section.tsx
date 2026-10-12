"use client";

/**
 * 「入门前置路线」区块（B 负责）。
 *
 * 放在学习路线页的**最上面**：在做现有学习路线（科研能力训练）之前，
 * 先对用户感兴趣的方向建立整体认知 —— 领域热点、著名实验、研究者、入门论文。
 * 方向来自测评的兴趣探测（画像）与「奇思妙想」的自由文本分析，两者合并去重。
 *
 * 内容性质与红线：这份导览是 AI 生成的**开放知识**，我们没有人工核验过的来源库
 * 可引用，所以**不挂核验来源、不参与任务进度**，并显式标注「AI 生成、未经核验」，
 * 与下面核验过的学习路线任务区分开（契约红线，见 `contracts/spark.ts`）。
 */
import { useState } from "react";

import type { InterestEntryRoute } from "@/contracts";
import { ensureSession, postJson } from "@/features/shared/api-client";
import { useIsClient, useLocalFlow } from "@/features/shared/use-local-flow";
import { collectInterestTags, saveEntryRoute } from "@/features/spark/store";
import { useSparkState } from "@/features/spark/use-sparks";

const SECTION_LABELS = {
  hotspots: "领域热点",
  milestones: "著名实验 / 里程碑",
  researchers: "值得了解的研究者",
  entryPapers: "入门论文 / 材料",
} as const;

type SectionKey = keyof typeof SECTION_LABELS;

function EntryRouteCard({ route }: { route: InterestEntryRoute }) {
  return (
    <article className="entry-route">
      <div className="notice notice-warn">
        <p className="small">这份导览由 AI 生成、未经人工核验 —— 人名、论文名与热点请以官方渠道为准。</p>
      </div>

      {route.overview ? <p className="entry-overview">{route.overview}</p> : null}

      {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => {
        const items = route[key];
        if (items.length === 0) return null;
        return (
          <div className="entry-section" key={key}>
            <h3 className="entry-subtitle">{SECTION_LABELS[key]}</h3>
            <ul className="entry-list">
              {items.map((item) => (
                <li key={`${key}-${item.title}`}>
                  <strong>{item.title}</strong>
                  <span className="muted small">{item.why}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </article>
  );
}

export function EntryRouteSection() {
  const isClient = useIsClient();
  const flow = useLocalFlow();
  const { sparks, entryRoutes } = useSparkState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!isClient) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在读取…
        </p>
      </section>
    );
  }

  const directions = collectInterestTags(flow?.profile.interests ?? [], sparks);

  if (directions.length === 0) {
    return (
      <section className="panel">
        <p className="eyebrow">入门前置路线</p>
        <h2 className="card-title">还没有兴趣方向</h2>
        <p className="muted">
          先通过一次科研测评、或在「奇思妙想」里写点自己的想法，确定你感兴趣的方向后，
          这里会为它生成一份入门导览：领域热点、著名实验、研究者与入门论文。
        </p>
      </section>
    );
  }

  const active = directions.find((direction) => direction.id === selectedId) ?? directions[0];
  const cached = entryRoutes[active.id];

  async function generate() {
    setProblem(null);
    setBusy(true);

    const session = await ensureSession();
    if (!session.ok) {
      setBusy(false);
      setProblem(`${session.message} 生成需要一个服务端确认的身份，请重试。`);
      return;
    }

    const result = await postJson<{ route: InterestEntryRoute }>("/api/entry-route", {
      directionId: active.id,
    });
    setBusy(false);

    if (!result.ok) {
      setProblem(result.message);
      return;
    }

    const saved = saveEntryRoute(result.data.route);
    if (!saved.ok) setProblem(saved.message);
  }

  return (
    <section className="panel entry-route-panel" aria-labelledby="entry-route-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">入门前置路线</p>
          <h1 id="entry-route-title">先认识「{active.label}」这个方向</h1>
          <p className="lead">
            在动手做科研之前，先对这个方向建立整体认知 —— 看完这份导览，再往下做学习路线会更顺。
          </p>
        </div>
      </div>

      {directions.length > 1 ? (
        <div className="tool-chips">
          {directions.map((direction) => (
            <button
              key={direction.id}
              type="button"
              className={direction.id === active.id ? "chip chip-active" : "chip"}
              onClick={() => setSelectedId(direction.id)}
            >
              {direction.label}
            </button>
          ))}
        </div>
      ) : null}

      {problem ? (
        <p className="error-text" role="alert">
          {problem}
        </p>
      ) : null}

      {cached ? (
        <EntryRouteCard route={cached} />
      ) : (
        <div className="card card-quiet">
          <p className="card-title">还没有「{active.label}」的入门导览</p>
          <p className="muted small">
            生成一份包含领域热点、著名实验、研究者与入门论文的导览，帮你在动手前先看清这个方向。
          </p>
          <div className="form-actions">
            <button type="button" className="button" onClick={() => void generate()} disabled={busy}>
              {busy ? "正在生成…" : "生成入门前置路线"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
