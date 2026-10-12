"use client";

/**
 * 「奇思妙想」页面（B 负责）。
 *
 * 定位：一个**自由的输入口**。用户把生活中的想法、灵感、日常记录、发现的问题
 * 或自己的长处写下来，AI 从中发现他的亮点、推断他可能感兴趣的科研方向。
 * 推断出的方向与测评的兴趣探测一起，成为学习路线「入门前置路线」的来源。
 *
 * 交互与降级：
 * - 分析走服务端（付费模型，需会话），失败时如实提示、**不清空输入框**，用户重试即可；
 * - 成功才落本地记录列表，失败不留半条「没有结果」的记录。
 */
import { useState } from "react";

import type { SparkAnalysis, SparkEntry } from "@/contracts";
import { ensureSession, postJson } from "@/features/shared/api-client";
import { useIsClient } from "@/features/shared/use-local-flow";
import { MAX_SPARK_TEXT } from "./analyze";
import { addSpark, createSparkEntry, deleteSpark } from "./store";
import { useSparkState } from "./use-sparks";

function SparkCard({ entry, onDelete }: { entry: SparkEntry; onDelete: () => void }) {
  return (
    <li className="card spark-card">
      <p className="spark-quote">“{entry.text}”</p>

      {entry.analysis ? (
        <>
          <p className="spark-subtitle">发现的亮点</p>
          <ul className="bullets">
            {entry.analysis.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>

          <p className="spark-subtitle">可能感兴趣的方向</p>
          {entry.analysis.interests.length > 0 ? (
            <ul className="tag-list">
              {entry.analysis.interests.map((interest) => (
                <li className="tag" key={interest.id}>
                  {interest.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">这次没有匹配到明确的方向。</p>
          )}

          {entry.analysis.response ? <p className="spark-response">{entry.analysis.response}</p> : null}

          <p className="muted small spark-rationale">为什么这样判断：{entry.analysis.rationale}</p>
        </>
      ) : (
        <p className="muted small">这条记录没有拿到分析结果。</p>
      )}

      <div className="spark-actions">
        <button type="button" className="button-ghost" onClick={onDelete}>
          删除这条
        </button>
      </div>
    </li>
  );
}

export function SparkPanel() {
  const isClient = useIsClient();
  const { sparks } = useSparkState();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!isClient) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在读取你的记录…
        </p>
      </section>
    );
  }

  async function analyze() {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setProblem("先写点什么，再点「分析一下」。");
      return;
    }

    setProblem(null);
    setBusy(true);

    const session = await ensureSession();
    if (!session.ok) {
      setBusy(false);
      setProblem(`${session.message} 分析需要一个服务端确认的身份，请重试。`);
      return;
    }

    const result = await postJson<{ analysis: SparkAnalysis }>("/api/sparks", { text: trimmed });
    setBusy(false);

    if (!result.ok) {
      setProblem(result.message);
      return;
    }

    // 成功才落记录；失败不留半条空记录，用户的重写也还留在输入框里。
    const entry = createSparkEntry(result.data.analysis.text, result.data.analysis);
    const saved = addSpark(entry);
    if (!saved.ok) {
      setProblem(saved.message);
      return;
    }

    setText("");
    setProblem(null);
  }

  function remove(id: string) {
    const result = deleteSpark(id);
    if (!result.ok) setProblem(result.message);
  }

  return (
    <section className="panel" aria-labelledby="spark-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">奇思妙想</p>
          <h1 id="spark-title">把一闪而过的想法，变成看得见的方向</h1>
          <p className="lead">
            写下你生活中的灵感、随手记下的问题、或者自认为的长处。AI 会从里面发现你的亮点，
            并猜出你可能感兴趣的方向 —— 这些方向会进入你的学习路线。
          </p>
        </div>
      </div>

      <article className="card">
        <h2 className="card-title">写点什么</h2>
        <p className="muted small">
          想法、灵感、日常记录、发现的问题、你的长处……什么都可以。写得越具体，方向猜得越准。
        </p>
        <textarea
          className="spark-input"
          value={text}
          maxLength={MAX_SPARK_TEXT}
          placeholder="例如：我最近总琢磨，怎么让手机自动整理相册里的重复照片，还能把同一件事的照片归到一块……"
          onChange={(event) => setText(event.target.value)}
        />
        <p className="muted small spark-count">
          {text.length} / {MAX_SPARK_TEXT}
        </p>

        {problem ? (
          <p className="error-text" role="alert">
            {problem}
          </p>
        ) : null}

        <div className="form-actions">
          <button type="button" className="button" onClick={() => void analyze()} disabled={busy}>
            {busy ? "正在分析…" : "分析一下"}
          </button>
          <p className="muted small">分析会调用 AI，通常需要十几秒，请稍等。</p>
        </div>
      </article>

      {sparks.length > 0 ? (
        <>
          <p className="spark-section-title">你的记录（{sparks.length}）</p>
          <ul className="spark-list">
            {sparks.map((entry) => (
              <SparkCard key={entry.id} entry={entry} onDelete={() => remove(entry.id)} />
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">还没有记录。写下第一条，看看 AI 能从你身上发现什么。</p>
      )}
    </section>
  );
}
