"use client";

/**
 * 科研认知测评（B 负责）—— **一次只问一题**。
 *
 * 与第一版最大的区别：用户不再一进门就面对一屏题目，而是先看到一段说明和一个开始按钮，
 * 之后每题一屏，下一题由 AI 依据上一条回答决定（见 `@/server/ai/assessment-coach`）。
 *
 * 三条设计考虑：
 *
 * 1. **评分仍在本地用确定性纯函数算**。AI 只负责"问什么"，不参与打分 ——
 *    画像必须可复现、可解释，不能因为模型换一次输出就让学生看到另一个结论。
 * 2. **AI 挂了也要能做完**。接口失败时会退回浏览器内的规则选题（同一套纯函数），
 *    并如实提示"当前用基础模式出题"，而不是把人卡在转圈上。
 * 3. **改前面的答案会让后面的题作废**。自适应提问是按已答内容推出来的，
 *    留着旧的后续问题会得到一个自相矛盾的对话。
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AssessmentAnswer,
  AssessmentMode,
  AssessmentQuestion,
  AssessmentStep,
  AssessmentStepProgress,
} from "@/contracts";
import { buildProfile } from "@/features/profile/build-profile";
import { ensureSession, postJson } from "@/features/shared/api-client";
import { formatDateTime } from "@/features/shared/format";
import { buildFlow, saveFlow } from "@/features/shared/local-bridge";
import { clearDraft, saveDraft } from "@/features/shared/local-session";
import { useIsClient } from "@/features/shared/use-local-flow";
import { useAssessmentDraft } from "@/features/shared/use-local-session";
import { planNextQuestion } from "./next-question";
import { DEMO_ANSWERS, getQuestionnaire } from "./question-bank";
import { buildSubmission, scoreAssessment } from "./scoring";

type Phase = "intro" | "asking";

type StepItem = {
  question: AssessmentQuestion;
  /** AI 给的一句衔接，规则模式下为 null。 */
  probe: string | null;
  reason: string;
  answer: AssessmentAnswer | null;
};

function answersOf(steps: StepItem[]): AssessmentAnswer[] {
  return steps
    .filter((step) => step.answer !== null)
    .map((step) => step.answer as AssessmentAnswer);
}

export function AssessmentForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<AssessmentMode>("full");
  const [steps, setSteps] = useState<StepItem[]>([]);
  /**
   * 服务端随每一步返回的进度。
   *
   * ⚠️ **必须用它，不要自己按题数推**（PRD v3 §4.1-A3）：原实现丢掉了这个字段，
   * 改用 `已答 / 已走过的题数`，于是进度条会随自适应出题回落、第一题就接近 100%。
   */
  const [serverProgress, setServerProgress] = useState<AssessmentStepProgress | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** AI 不可用、已退回规则选题。 */
  const [basicMode, setBasicMode] = useState(false);
  const [demoFilled, setDemoFilled] = useState(false);
  /**
   * 等下一题已经等了多少秒（PRD v3 §4.2-B2）。
   *
   * 完整版会有 1～2 次 AI 介入来挑下一题。**生产实测 3 次：9.94 / 10.29 / 11.08 秒**
   * （见《部署与线上验证记录》§4.4）—— 文案按生产写，本机更慢不代表用户会那么慢。
   * 原先这段等待只有按钮上一句"正在想下一个问题…"，用户不知道要等多久。
   */
  const [elapsed, setElapsed] = useState(0);

  /**
   * 等待计时器。只在 `busy` 期间跑。
   *
   * ⚠️ 归零放在 `start()` / `goNext()` 里，**不在 effect 体里同步 `setState`** ——
   * React 的 lint 规则会拦（会触发级联渲染）。事件处理器才是它该待的地方。
   * 秒数用时间戳算差值而不是累加：标签页切后台时定时器会被降频，累加会偏慢。
   */
  useEffect(() => {
    if (!busy) return undefined;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [busy]);

  /**
   * 没答完的测评草稿（PRD §4.6 的 C1）。
   *
   * 一个 2～4 分钟的测评，刷新或误点离开就全丢了、还没法续做 —— 那是真实的数据丢失。
   * 这里读草稿只为了问一句"要不要接着上次答"，**不自动恢复**：
   * 用户该知道自己接上的是哪一条，而不是莫名其妙地出现在第 7 题。
   * `useIsClient()` 挡首屏 —— 服务端没有 localStorage，不挡会把"服务端没数据"渲染成"没有草稿"。
   */
  const isClient = useIsClient();
  const draft = useAssessmentDraft();

  /**
   * 测评是否已经结束。用来关掉下面那个存草稿的 effect ——
   * 否则 `finish()` 清掉草稿之后，页面在跳转前还可能再渲染一次，把刚清掉的草稿又写回去。
   */
  const finishedRef = useRef(false);

  /**
   * 每答一题就把草稿写回本地。
   *
   * ⚠️ 不能写在 `setSteps` 的更新函数里：那个函数在严格模式下会执行两次，
   * 副作用放进去会被重复触发。写外部存储本来就是 effect 该干的事。
   */
  useEffect(() => {
    if (finishedRef.current) return;
    if (phase !== "asking" || steps.length === 0) return;
    saveDraft({ mode, steps, cursor, basicMode });
  }, [phase, mode, steps, cursor, basicMode]);

  /** 接着上次答（C1）。只有通过结构校验的草稿才会被读到。 */
  function resumeDraft() {
    if (!draft) return;
    setMode(draft.mode);
    setSteps(draft.steps);
    setCursor(draft.cursor);
    setBasicMode(draft.basicMode);
    setProblem(null);
    setPhase("asking");
  }

  /** 重新开始：先清草稿 —— 否则它会一直留在介绍页问"要不要接着答"。 */
  function startOver() {
    clearDraft();
    reset(mode);
  }

  const current = steps[cursor];

  function reset(nextMode: AssessmentMode) {
    setMode(nextMode);
    setSteps([]);
    setCursor(0);
    setProblem(null);
    setBasicMode(false);
    setDemoFilled(false);
  }

  /** 向服务端要下一题；失败则用浏览器内的规则选题。 */
  async function requestNextStep(nextSteps: StepItem[], nextMode: AssessmentMode): Promise<AssessmentStep> {
    const answers = answersOf(nextSteps);
    const askedQuestionIds = nextSteps.map((step) => step.question.id);
    const payload = { mode: nextMode, answers, askedQuestionIds };

    const session = await ensureSession();
    if (session.ok) {
      const result = await postJson<AssessmentStep>("/api/assessment/next", payload);
      if (result.ok) {
        setBasicMode(false);
        return result.data;
      }
    }

    // 走到这里说明 AI 这条路不通 —— 用规则出题，并如实告诉用户。
    setBasicMode(true);
    return planNextQuestion(payload);
  }

  async function start() {
    setBusy(true);
    setProblem(null);
    setElapsed(0);

    const first = await requestNextStep([], mode);

    if (first.done || !first.question) {
      setBusy(false);
      setProblem("题库没有可用的题目，请稍后重试。");
      return;
    }

    setSteps([{ question: first.question, probe: first.probe, reason: first.reason, answer: null }]);
    setServerProgress(first.progress);
    setCursor(0);
    setPhase("asking");
    setBusy(false);
  }

  function chooseAnswer(questionId: string, optionId: string, multiple: boolean) {
    setProblem(null);
    setSteps((previous) => {
      const index = previous.findIndex((step) => step.question.id === questionId);
      if (index === -1) return previous;

      const target = previous[index];
      const selected = target.answer?.optionIds ?? [];
      const optionIds = multiple
        ? selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : [...selected, optionId]
        : [optionId];

      const updated: StepItem = { ...target, answer: { questionId, optionIds, unknown: false } };
      // 改答案会让后面按旧答案推出来的问题作废，直接截断。
      const kept = [...previous.slice(0, index), updated];
      setCursor(index);
      return kept;
    });
  }

  function markUnknown(questionId: string) {
    setProblem(null);
    setSteps((previous) => {
      const index = previous.findIndex((step) => step.question.id === questionId);
      if (index === -1) return previous;

      const target = previous[index];
      const updated: StepItem = {
        ...target,
        answer: { questionId, optionIds: [], unknown: !(target.answer?.unknown ?? false) },
      };
      setCursor(index);
      return [...previous.slice(0, index), updated];
    });
  }

  async function goNext() {
    if (!current) return;

    if (!current.answer || (current.answer.optionIds.length === 0 && !current.answer.unknown)) {
      setProblem("先选一个，或者点「不太清楚 / 没接触过」再继续。");
      return;
    }

    // 前面还有已经问过的题，先顺着走，不必重新规划。
    if (cursor < steps.length - 1) {
      setCursor(cursor + 1);
      setProblem(null);
      return;
    }

    setBusy(true);
    setProblem(null);
    setElapsed(0);

    const step = await requestNextStep(steps, mode);
    // 每一步都要刷新进度 —— 只设初值的话进度条会永远停在 0（本轮实测踩到过）。
    setServerProgress(step.progress);

    if (step.done || !step.question) {
      await finish(steps, mode, demoFilled);
      return;
    }

    setSteps([...steps, { question: step.question, probe: step.probe, reason: step.reason, answer: null }]);
    setCursor(steps.length);
    setBusy(false);
  }

  /**
   * 生成画像：评分、画像、路线全部走确定性纯函数，与 AI 无关。
   *
   * ⚠️ `finalMode` / `isDemo` **必须由调用方显式传入，不能在这里读 state。**
   * 原来这里读 `mode` 与 `demoFilled`，而"用示例答案"按钮是在**同一个 tick 里**先
   * `setMode/setDemoFilled` 再调本函数 —— React 的 state 还没更新，于是用示例答案
   * 生成的画像**没有被打上 `isDemo` 标记**（违反契约"演示数据必须显式标记"），
   * 提交里的 `questionnaireId` 也还是全量版。改为显式传参后，这类时序问题不可能再出现。
   */
  async function finish(finalSteps: StepItem[], finalMode: AssessmentMode, isDemo: boolean) {
    setBusy(true);
    setProblem(null);

    const session = await ensureSession();
    if (!session.ok) {
      setBusy(false);
      setProblem(`${session.message} 画像需要一个服务端确认的身份，请重试。`);
      return;
    }

    const questionnaire = getQuestionnaire(finalMode);
    const submittedAt = new Date().toISOString();
    const submission = buildSubmission(questionnaire, answersOf(finalSteps), submittedAt);
    const scoring = scoreAssessment(questionnaire, submission);
    const submissionId = `sub-${Date.parse(submittedAt)}`;

    const profile = buildProfile({
      userId: session.data.session.userId,
      submissionId,
      scoring,
      generatedAt: submittedAt,
      isDemo,
    });

    const saved = saveFlow(buildFlow({ submission, profile, roadmap: null, savedAt: submittedAt, isDemo }));
    setBusy(false);

    if (!saved.ok) {
      setProblem(saved.message);
      // 保存失败就**不清草稿** —— 用户重试或刷新时还能接着答，不至于白做一场。
      return;
    }

    /*
     * C1：测评到这一步就结束了，草稿不该再留着 ——
     * 否则用户下次进测评页会被问一句"要不要接着上次答"，而他上次其实答完了。
     * `finishedRef` 同时关掉上面那个存草稿的 effect，避免跳转前又把它写回去。
     */
    finishedRef.current = true;
    clearDraft();
    router.push("/profile");
  }

  /**
   * 演示快速通道：直接填入示例答案，跳过整段对话。
   *
   * 这里**显式**把 `"demo"` 与 `isDemo: true` 传给 `finish`，不依赖 state ——
   * `setState` 在本次执行里还没生效（见 `finish` 的说明）。
   * 顺带用显式循环替代了原来的 `as AssessmentQuestion` 断言，题目对不上时直接跳过而不是硬转。
   */
  async function runDemoAnswers() {
    const demoQuestionnaire = getQuestionnaire("demo");
    const demoSteps: StepItem[] = [];
    for (const answer of DEMO_ANSWERS) {
      const question = demoQuestionnaire.questions.find((item) => item.id === answer.questionId);
      if (question) demoSteps.push({ question, probe: null, reason: "", answer });
    }

    setMode("demo");
    setDemoFilled(true);
    setSteps(demoSteps);
    await finish(demoSteps, "demo", true);
  }

  /* ----------------------------- 介绍页 ----------------------------- */
  if (phase === "intro") {
    return (
      <section className="panel" aria-labelledby="assessment-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">科研认知测评</p>
            <h1 id="assessment-title">先认识自己现在的位置</h1>
            <p className="lead">
              不是考试，也没有对错。我会一道一道地问，根据你的回答决定下一个问什么 ——
              所以题量是因人而异的，大致 8～12 道。
            </p>
          </div>
        </div>

          {/*
            C1（PRD §4.6）：上次没答完就问一句。
            放在最上面 —— 要接着答的人第一眼就该看到，而不是往下翻过一整页说明。
          */}
          {isClient && draft ? (
            <article className="card card-highlight">
              <h2 className="card-title">上次的测评还没答完</h2>
              <p className="muted small">
                上次答到第 {draft.cursor + 1} 题，已经答了{" "}
                {draft.steps.filter((step) => step.answer !== null).length} 题（
                {formatDateTime(draft.savedAt)}）。接着答就从那里继续，不用重来。
              </p>
              <div className="form-actions">
                <button type="button" className="button" onClick={resumeDraft}>
                  接着上次答
                </button>
                <button type="button" className="button-ghost" onClick={startOver}>
                  重新开始
                </button>
              </div>
            </article>
          ) : null}

          <article className="card">
            <h2 className="card-title">会聊到这些方面</h2>
          <ul className="bullets">
            <li>你对「科研在做什么」的当前印象</li>
            <li>论文、检索、研究方法接触到哪一步</li>
            <li>编程与英文阅读的基础</li>
            <li>已经有过哪些真实经历</li>
            <li>感兴趣的方向，以及每周能投入多少时间</li>
          </ul>
          <p className="muted small">
            遇到真的不清楚的题目，直接选「不太清楚」就好 —— 那同样是有用的信息，不会扣分。
            不需要注册，也不会采集姓名、学号或手机号。
          </p>
        </article>

        <div className="mode-switch" role="group" aria-label="选择题量">
          <button type="button" className={mode === "full" ? "chip chip-active" : "chip"} onClick={() => reset("full")}>
            完整版
          </button>
          <button type="button" className={mode === "demo" ? "chip chip-active" : "chip"} onClick={() => reset("demo")}>
            演示版（更短）
          </button>
        </div>

        {problem ? (
          <p className="error-text" role="alert">
            {problem}
          </p>
        ) : null}

        <div className="form-actions">
          <button type="button" className="button" onClick={() => void start()} disabled={busy}>
            {busy ? "正在准备第一个问题…" : "开始测评"}
          </button>
          <button type="button" className="button-ghost" onClick={() => void runDemoAnswers()} disabled={busy}>
            用示例答案直接看结果
          </button>
        </div>
      </section>
    );
  }

  /* ----------------------------- 答题中 ----------------------------- */
  if (!current) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在准备问题…
        </p>
      </section>
    );
  }

  const answered = steps.filter((step) => step.answer !== null).length;

  /**
   * 进度条的分母用服务端给的「方面总数」，**不是已走过的题数**。
   *
   * ⚠️ 这是 PRD v3 §4.1-A3 的修复。原实现是 `answered / steps.length`，两个症状：
   *  - 分母随自适应出题一路增长 → 翻页时进度条**回落**（第 1 题 100%、第 2 题 50%…）
   *  - 第一题分子也是 1 → **一上来就 100%**，用户会以为只有一题
   *  - 外部测试还观察到「点一下选项进度条就往前」—— 因为选中即写入 `answer`
   *
   * 而 `resolvedDimensions / totalDimensions` **事先可知、只增不减**，
   * 而且对用户更有意义：**还有几个方面没问出结论**。
   */
  const totalDimensions = serverProgress?.totalDimensions ?? 0;
  const resolvedDimensions = serverProgress?.resolvedDimensions ?? 0;
  const progressRatio = totalDimensions > 0 ? resolvedDimensions / totalDimensions : 0;

  return (
    <section className="panel" aria-labelledby="question-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">
            第 {cursor + 1} 题 · 已答 {answered} 题
            {totalDimensions > 0 ? ` · 已能判断 ${resolvedDimensions} / ${totalDimensions} 个方面` : ""}
          </p>
          <h1 id="question-title">{current.question.prompt}</h1>
        </div>
        {current.question.type === "multi" ? <span className="badge">可多选</span> : null}
      </div>

      <div className="progress-block">
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressRatio * 100)}
          aria-valuetext={
            totalDimensions > 0
              ? `已经能判断 ${resolvedDimensions} / ${totalDimensions} 个方面`
              : "进度未知"
          }
        >
          <span style={{ width: `${progressRatio * 100}%` }} />
        </div>
        <p className="muted small">
          {basicMode ? "当前用基础模式出题（AI 暂时不可用），题目依然会跟着你的回答变化。" : "下一题由 AI 根据你的回答决定。"}
        </p>
      </div>

      {current.probe ? <p className="probe-line">{current.probe}</p> : null}

      {problem ? (
        <p className="error-text" role="alert">
          {problem}
        </p>
      ) : null}

      <div className="option-list option-list-large">
        {current.question.options.map((option) => {
          const checked = current.answer?.optionIds.includes(option.id) ?? false;
          return (
            <label className={checked ? "option option-checked" : "option"} key={option.id}>
              <input
                type={current.question.type === "multi" ? "checkbox" : "radio"}
                name={current.question.id}
                checked={checked}
                onChange={() => chooseAnswer(current.question.id, option.id, current.question.type === "multi")}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>

      {current.question.allowUnknown ? (
        <button
          type="button"
          className={current.answer?.unknown ? "unknown-toggle unknown-toggle-on" : "unknown-toggle"}
          aria-pressed={current.answer?.unknown ?? false}
          onClick={() => markUnknown(current.question.id)}
        >
          {current.answer?.unknown ? "已标记：不太清楚 ✓" : "不太清楚 / 没接触过"}
        </button>
      ) : null}

      {/*
        B6（PRD v3 §4.2）：原来写「为什么问这一题」，外部测试原话是
        「很好的小栏：不明所以，用户看不懂」—— 折叠栏本身是好设计，
        但那五个字没说清里面是什么。改成直说这一栏会告诉你什么。
      */}
      <details className="reason-box">
        <summary>这一题在了解什么</summary>
        <p className="muted small">{current.reason}</p>
      </details>

      {/*
        B2（PRD v3 §4.2）：等下一题时给出真实秒数。
        生产实测出题 3 次 9.94 / 10.29 / 11.08 秒，所以文案写 10～30 秒（留余量）。

        这段文案同样有一段沿革：
        - B2 刚做时**刻意不写**"作答已经记下了"—— 那时作答只在组件 state 里，
          `saveFlow` 要到 `finish()` 才调用，刷新或离开就全丢。如实提醒用户才对。
        - **C1 落地后可以如实说"会留着"了**：每答一题都写进本地草稿，
          回来时介绍页会问"要不要接着上次答"。所以现在既不骗人、也不用再让人守着屏幕。
      */}
      {busy ? (
        <p className="muted small">
          正在根据你前面的回答挑下一题 —— 通常 10～30 秒，已经等了 {elapsed} 秒。
          {elapsed >= 20 ? (
            <span role="status" aria-live="polite">
              {" "}
              还在挑，请再稍等。已经答过的题会留着 —— 要是先去做别的，回来接着答就行。
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="button" className="button" onClick={() => void goNext()} disabled={busy}>
          {busy ? "正在想下一个问题…" : cursor === steps.length - 1 ? "继续" : "下一题"}
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={() => setCursor(Math.max(0, cursor - 1))}
          disabled={cursor === 0 || busy}
        >
          上一题
        </button>
      </div>
    </section>
  );
}
