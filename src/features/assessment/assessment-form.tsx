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
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentAnswer, AssessmentMode, AssessmentQuestion, AssessmentStep } from "@/contracts";
import { buildProfile } from "@/features/profile/build-profile";
import { ensureSession, postJson } from "@/features/shared/api-client";
import { buildFlow, saveFlow } from "@/features/shared/local-bridge";
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
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** AI 不可用、已退回规则选题。 */
  const [basicMode, setBasicMode] = useState(false);
  const [demoFilled, setDemoFilled] = useState(false);

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

    const first = await requestNextStep([], mode);

    if (first.done || !first.question) {
      setBusy(false);
      setProblem("题库没有可用的题目，请稍后重试。");
      return;
    }

    setSteps([{ question: first.question, probe: first.probe, reason: first.reason, answer: null }]);
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

    const step = await requestNextStep(steps, mode);

    if (step.done || !step.question) {
      await finish(steps);
      return;
    }

    setSteps([...steps, { question: step.question, probe: step.probe, reason: step.reason, answer: null }]);
    setCursor(steps.length);
    setBusy(false);
  }

  /** 生成画像：评分、画像、路线全部走确定性纯函数，与 AI 无关。 */
  async function finish(finalSteps: StepItem[]) {
    setBusy(true);
    setProblem(null);

    const session = await ensureSession();
    if (!session.ok) {
      setBusy(false);
      setProblem(`${session.message} 画像需要一个服务端确认的身份，请重试。`);
      return;
    }

    const questionnaire = getQuestionnaire(mode);
    const submittedAt = new Date().toISOString();
    const submission = buildSubmission(questionnaire, answersOf(finalSteps), submittedAt);
    const scoring = scoreAssessment(questionnaire, submission);
    const submissionId = `sub-${Date.parse(submittedAt)}`;

    const profile = buildProfile({
      userId: session.data.session.userId,
      submissionId,
      scoring,
      generatedAt: submittedAt,
      isDemo: demoFilled,
    });

    const saved = saveFlow(buildFlow({ submission, profile, roadmap: null, savedAt: submittedAt, isDemo: demoFilled }));
    setBusy(false);

    if (!saved.ok) {
      setProblem(saved.message);
      return;
    }

    router.push("/profile");
  }

  /** 演示快速通道：直接填入示例答案，跳过整段对话。 */
  async function runDemoAnswers() {
    setMode("demo");
    setDemoFilled(true);
    const demoSteps: StepItem[] = DEMO_ANSWERS.map((answer) => ({
      question: getQuestionnaire("demo").questions.find((question) => question.id === answer.questionId) as AssessmentQuestion,
      probe: null,
      reason: "",
      answer,
    })).filter((step) => Boolean(step.question));

    setSteps(demoSteps);
    await finish(demoSteps);
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
  const progressRatio = steps.length === 0 ? 0 : answered / Math.max(steps.length, 1);

  return (
    <section className="panel" aria-labelledby="question-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">
            第 {cursor + 1} 题 · 已答 {answered} 题
          </p>
          <h1 id="question-title">{current.question.prompt}</h1>
        </div>
        {current.question.type === "multi" ? <span className="badge">可多选</span> : null}
      </div>

      <div className="progress-block">
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressRatio * 100)}>
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

      <details className="reason-box">
        <summary>为什么问这一题</summary>
        <p className="muted small">{current.reason}</p>
      </details>

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
