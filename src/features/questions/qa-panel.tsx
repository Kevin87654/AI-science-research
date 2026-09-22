"use client";

/**
 * 科研问答面板（C 负责）。
 *
 * ## 界面上必须让人分清三件事
 *
 * 1. **这条回答是谁给的** —— `decidedBy` 为 `ai` 时显示"模型生成"角标。
 *    规则回答与模型回答长得一样但可信度来源不同，混在一起就是在误导用户。
 * 2. **证据覆盖到什么程度** —— `status` 是 `supported / limited / unknown`，
 *    分别对应"资料里有明确依据""只覆盖了一部分""现有资料无法确认"。
 *    ⚠️ 它是**证据覆盖程度，不是模型置信度**，所以文案里不出现"可能""大概"这类措辞。
 * 3. **依据在哪** —— 引用必须逐条列出可点的官网链接与核对日期；
 *    一条引用都还原不出来时，引擎会整条降级，界面就只显示"无法确认"。
 *
 * ## 为什么问题要发到服务端
 *
 * 规则引擎是纯函数，理论上可以在浏览器里直接跑。仍然走 `/api/questions` 的原因是：
 * 下一轮接模型时**只能在服务端**做（密钥不能进浏览器），如果现在图省事在前端算，
 * 接 AI 那天整个交互层都要重写。现在这样，`decidedBy` 从 `rules` 变成 `ai` 时，
 * 这个组件一行都不用改。
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import type { Answer, QuestionResult, Source } from "@/contracts";
import { sourceFreshness } from "@/features/resources/catalog";
import { ensureSession, postJson } from "@/features/shared/api-client";

/** 快捷问题：直接取 FAQ 的问题文本，避免在界面上再维护一份。 */
export type QuickQuestion = {
  id: string;
  question: string;
  category: string;
};

const STATUS_LABEL: Record<Answer["status"], string> = {
  supported: "资料中有明确依据",
  limited: "只覆盖了其中一部分",
  unknown: "现有资料无法确认",
};

function CitationList({ citations }: { citations: Source[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="qa-citations">
      <h3 className="qa-subtitle">依据（{citations.length} 条）</h3>
      <ul className="qa-citation-list">
        {citations.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title}
            </a>
            <p className="small muted">
              {source.publisher} · 我们核对页面的日期：{source.checkedAt}
              {source.pageUpdatedAt
                ? ` · 页面自身更新日期：${source.pageUpdatedAt}`
                : " · 页面自身更新日期：官网未标明"}
            </p>
            <p className="small muted">{source.evidenceSummary}</p>
            <p className="small muted">{sourceFreshness(source)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 回答卡片。
 *
 * 标题用**用户实际问的那句**，不是引擎给的 `heading`（PRD v3 §4.1-A5）。
 * 原先直接用 `answer.heading`，于是问「本科生怎么联系导师」会显示
 * 「第一次联系导师怎么准备？」—— 那条 heading 其实是命中的 FAQ 标题，
 * 用户会觉得答非所问。
 *
 * FAQ 标题并没有丢：与用户问句不同的时候，它在下面以「对应常见问题」出现，
 * 顺便交代这条回答是从哪条 FAQ 来的。相同时（用户直接点了快捷问题）就不重复显示。
 */
function AnswerView({
  result,
  askedQuestion,
  faqQuestions,
}: {
  result: QuestionResult;
  askedQuestion: string | null;
  /** 已知的 FAQ 问题原文，用来判断 `heading` 是不是真的来自某条 FAQ。 */
  faqQuestions: ReadonlySet<string>;
}) {
  const { answer, decidedBy } = result;

  const heading = askedQuestion?.trim() || answer.heading;
  /**
   * ⚠️ **只有 heading 真是某条 FAQ 的问题时，才标注"对应常见问题"。**
   *
   * 引擎的 `heading` 有六种取值，只有一种是 FAQ 标题（`heading: faq.question`），
   * 其余是「需要进一步确认」「可进一步了解的教师」「公开联系信息」这类**段落标题**。
   * 不加这个判断的话，兜底回答上会冒出一句「对应常见问题：需要进一步确认」——
   * 把一个状态当成了用户问过的问题，比原来的问题更糟。
   */
  const sourceFaq =
    askedQuestion && heading !== answer.heading && faqQuestions.has(answer.heading) ? answer.heading : null;

  return (
    <article className="card qa-answer" aria-live="polite">
      <div className="qa-answer-head">
        <div>
          <h2 className="card-title">{heading}</h2>
          {sourceFaq ? <p className="muted small">对应常见问题：{sourceFaq}</p> : null}
        </div>
        <div className="qa-badges">
          <span className={`status-pill qa-status-${answer.status}`}>{STATUS_LABEL[answer.status]}</span>
          <span className={decidedBy === "ai" ? "status-pill qa-by-ai" : "status-pill"}>
            {decidedBy === "ai" ? "模型生成" : "规则回答"}
          </span>
        </div>
      </div>

      <p className="qa-text">{answer.answer}</p>

      {answer.actions.length > 0 && (
        <div className="qa-actions">
          <h3 className="qa-subtitle">下一步可以做的事</h3>
          <ul className="bullets">
            {answer.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <CitationList citations={answer.citations} />

      <dl className="qa-meta small muted">
        <div>
          <dt>这条回答的边界</dt>
          <dd>{answer.limitation}</dd>
        </div>
        <div>
          <dt>怎么产生的</dt>
          <dd>{answer.provenance}</dd>
        </div>
      </dl>

      {answer.teacherIds.length > 0 && (
        <p className="small">
          涉及校内资源 ——{" "}
          <Link className="qa-inline-link" href="/resources">
            去教师资料页看详情与来源
          </Link>
        </p>
      )}
    </article>
  );
}

export function QaPanel({ quickQuestions }: { quickQuestions: QuickQuestion[] }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<QuestionResult | null>(null);
  /**
   * **实际提交出去的那一句**（PRD v3 §4.1-A5）。
   *
   * 不能拿输入框里的 `question` 当标题：点快捷问题时 `ask()` 传的是 FAQ 原话，
   * 而输入框的内容可能已经被用户改过。所以把"真正问出去的那句"单独记下来。
   */
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  /**
   * 提问已经等了多少秒（PRD v3 §4.2-B1）。
   *
   * 有证据的提问要调模型，**线上实测 15～32 秒**（生产比本机快，别按本机数字写文案）。
   * 原先这段等待界面只有一句"查询中…"，用户不知道还要多久，演示时很容易被当成卡死。
   */
  const [elapsed, setElapsed] = useState(0);
  /** FAQ 问题原文集合，供回答卡片判断 heading 的来历。 */
  const faqQuestions = new Set(quickQuestions.map((item) => item.question));

  /**
   * 等待计时器。只在 `busy` 期间跑。
   *
   * ⚠️ 不要在 effect 体里同步 `setState` 归零 —— React 的 lint 规则会拦
   * （"Calling setState synchronously within an effect can trigger cascading renders"）。
   * 归零放在 `ask()` 里做，那是事件处理器，是它该待的地方。
   *
   * 用时间戳算差值而不是每次 +1：标签页切到后台时定时器会被降频，
   * 累加会明显偏慢，而用户看到的秒数必须是真的。
   */
  useEffect(() => {
    if (!busy) return undefined;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busy]);

  const canSubmit = question.trim().length > 0 && !busy;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    setBusy(true);
    setProblem(null);
    setElapsed(0);

    // 问答接口要求带会话（下一轮接模型后它就是费用闸门），所以先确保身份存在。
    const session = await ensureSession();
    if (!session.ok) {
      setBusy(false);
      setProblem(session.message);
      return;
    }

    const response = await postJson<QuestionResult>("/api/questions", { question: trimmed });
    setBusy(false);

    if (!response.ok) {
      setProblem(response.message);
      return;
    }

    setResult(response.data);
    setAskedQuestion(trimmed);
  }

  /** 常见问题列表。展开态与折叠态共用同一份，避免两处维护必然漂移。 */
  const quickList = (
    <ul className="tag-list">
      {quickQuestions.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setQuestion(item.question);
              void ask(item.question);
            }}
          >
            {item.question}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="panel qa-panel">
      <header className="panel-header">
        <div>
          <h1>科研问答</h1>
          <p className="lead">
            只根据已核验的教师资料与整理过的常见问题回答。资料里没有的，会明确说“无法确认”，
            而不是编一个听起来合理的答案。
          </p>
        </div>
      </header>

      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label className="visually-hidden" htmlFor="qa-input">
          输入你的问题
        </label>
        <input
          id="qa-input"
          className="note-input"
          type="text"
          value={question}
          placeholder="例如：深大有哪些研究知识图谱的老师？"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="button-small" disabled={!canSubmit}>
          {busy ? "查询中…" : "提问"}
        </button>
      </form>

      {/*
        B1（PRD v3 §4.2）：等待期间给出**真实进度**，而不是只有一句"查询中"。
        耗时按**生产**数字（15～60 秒）—— 本机 24～132 秒只是环境慢，别写进文案。

        ⚠️ **刻意不写"可以先去别的页面看看"**：`result` 只是组件 state、没有任何持久化，
        离开这一页这次的回答就丢了。PRD 原来那句建议会让用户白等一场。
        ⚠️ `aria-live` 只放在满 20 秒才出现的那句上：秒数每秒都在变，
        若整段都算 live region，读屏会每秒播报一次。
      */}
      {busy ? (
        <p className="small muted">
          正在核对资料并生成回答 —— 通常需要 15～60 秒，已经等了 {elapsed} 秒。
          {elapsed >= 20 ? (
            <span role="status" aria-live="polite">
              {" "}
              比平时久一些，但还在正常生成。请留在这一页：离开后这次的回答不会保留。
            </span>
          ) : null}
        </p>
      ) : null}

      {/*
        B3（PRD v3 §4.2）：回答出现后把常见问题**收起来**。
        原先 12 条 chip 常驻铺满三行，回答出来之后注意力仍被它们分走。
        不是删掉 —— 想换一个问题的人照样点得到，只是不再占着屏幕。
      */}
      {result ? (
        <details className="qa-quick">
          <summary className="small muted">换一个常见问题</summary>
          {quickList}
        </details>
      ) : (
        <div className="qa-quick">
          <p className="small muted">常见问题：</p>
          {quickList}
        </div>
      )}

      {problem && <p className="error-text" role="alert">{problem}</p>}

      {result ? (
        <AnswerView result={result} askedQuestion={askedQuestion} faqQuestions={faqQuestions} />
      ) : (
        !busy && (
          <div className="card card-quiet">
            <p className="card-title">可以问什么</p>
            <ul className="bullets small">
              <li>某位老师的公开研究方向、公开邮箱</li>
              <li>官网里写明的本科生参与说明（名额一律不猜）</li>
              <li>怎么读第一篇论文、怎么准备联系导师这类科研入门问题</li>
            </ul>
            <p className="small muted">
              问不到的问题会明确告诉你“无法确认”，并给出官方核验路径 —— 这是设计，不是故障。
            </p>
          </div>
        )
      )}
    </div>
  );
}
