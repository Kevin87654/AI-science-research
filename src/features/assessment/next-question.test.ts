/**
 * 自适应选题测试（B 负责）。
 *
 * 这里盯的是三件容易出错、用户又立刻能感觉到的事：
 * 1. **题目不会重复问**，也不会漏掉某个维度的核心问题；
 * 2. **答得浅就不再追问** —— 自适应省的是深入题，不是覆盖面；
 * 3. **没问过的维度不算缺口** —— 否则"因为没问到"会被写成"你不会"。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AssessmentAnswer, AssessmentMode, AssessmentQuestion, AssessmentStep } from "../../contracts/assessment.ts";
import { DEMO_ANSWERS, DEMO_QUESTIONNAIRE, QUESTION_BY_ID } from "./question-bank.ts";
import { DEEPEN_BUDGET, planNextQuestion, rankCandidates } from "./next-question.ts";
import { scoreFromAnswers } from "./scoring.ts";

const NOW = "2026-09-21T16:00:00+08:00";

/** 取该题得分最高 / 最低的选项；分数全为 null（兴趣、时间、目标）时取第一个。 */
function pickOption(question: AssessmentQuestion, level: "highest" | "lowest"): AssessmentAnswer {
  const scored = question.options.filter((option) => option.score !== null);
  if (scored.length === 0) {
    return { questionId: question.id, optionIds: [question.options[0].id], unknown: false };
  }

  const chosen = scored.reduce((best, option) => {
    const better = level === "highest" ? (option.score ?? 0) > (best.score ?? 0) : (option.score ?? 0) < (best.score ?? 0);
    return better ? option : best;
  });

  return { questionId: question.id, optionIds: [chosen.id], unknown: false };
}

/** 一直答到出画像为止，返回提问顺序与最后一次结果。 */
function drain(mode: AssessmentMode, level: "highest" | "lowest") {
  const asked: string[] = [];
  const answers: AssessmentAnswer[] = [];
  let step: AssessmentStep = planNextQuestion({ mode, answers, askedQuestionIds: asked });

  for (let guard = 0; !step.done && guard < 40; guard += 1) {
    assert.ok(step.question, "未完成时必须有下一题");
    const question = step.question;

    asked.push(question.id);
    answers.push(pickOption(question, level));

    step = planNextQuestion({ mode, answers, askedQuestionIds: asked });
  }

  return { asked, answers, lastStep: step };
}

test("第一题是「科研认知」的核心题", () => {
  const step = planNextQuestion({ mode: "full", answers: [], askedQuestionIds: [] });

  assert.equal(step.done, false);
  assert.equal(step.question?.id, "q-research-what");
  assert.equal(step.decidedBy, "rule");
  // 规则模式不编造点评。
  assert.equal(step.probe, null);
  assert.ok(step.reason.length > 0);
  assert.deepEqual(step.progress, { resolvedDimensions: 0, totalDimensions: 8, answeredCount: 0 });
});

test("题目不会重复问，且最后每个维度都拿到结论", () => {
  const { asked, lastStep } = drain("full", "lowest");

  assert.equal(new Set(asked).size, asked.length, "题号不能重复");
  assert.equal(lastStep.done, true);
  assert.equal(lastStep.question, null);
  assert.equal(lastStep.progress.resolvedDimensions, lastStep.progress.totalDimensions);
  assert.ok(lastStep.reason.length > 0, "收尾也要说明理由");

  // 全选最低档：不该触发任何深入题。
  assert.ok(asked.length <= 9, `答得浅时不该追问，实际问了 ${asked.length} 道`);
});

test("答得稳才深挖：全选最高档会用到深入题，且不超预算", () => {
  const { asked } = drain("full", "highest");

  const deepens = asked.filter((id) => id.endsWith("hypothesis") || id.endsWith("venue") || id.endsWith("judge") || id.endsWith("design") || id.endsWith("read") || id.endsWith("activity"));
  assert.ok(deepens.length > 0, "全选最高档应该触发深入题");
  assert.ok(deepens.length <= DEEPEN_BUDGET.full, `深入题 ${deepens.length} 道，超过预算 ${DEEPEN_BUDGET.full}`);
});

test("演示模式只问演示题，且不深挖", () => {
  const { asked } = drain("demo", "highest");

  for (const id of asked) {
    assert.ok(DEMO_QUESTIONNAIRE.questions.some((question) => question.id === id), `${id} 不属于演示题库`);
  }
  assert.equal(DEEPEN_BUDGET.demo, 0);
  assert.ok(asked.length <= DEMO_QUESTIONNAIRE.questions.length);
});

test("候选清单里深入题排在核心题前面", () => {
  // 用一个「科研认知答得很好」的作答去要候选。
  const answers: AssessmentAnswer[] = [
    { questionId: "q-research-what", optionIds: ["research-question"], unknown: false },
  ];
  const ranking = rankCandidates({ mode: "full", answers, askedQuestionIds: ["q-research-what"] });

  assert.ok(ranking.candidates.length > 0);
  assert.equal(ranking.candidates[0].kind, "deepen");
  assert.equal(ranking.candidates[0].question.id, "q-research-hypothesis");
});

test("明确「不知道」也算结论，不会反复问同一维度", () => {
  const answers: AssessmentAnswer[] = [{ questionId: "q-research-what", optionIds: [], unknown: true }];
  const ranking = rankCandidates({ mode: "full", answers, askedQuestionIds: ["q-research-what"] });

  assert.ok(!ranking.candidates.some((candidate) => candidate.question.id === "q-research-what"));
  // 答得浅，也不该深挖。
  assert.ok(!ranking.candidates.some((candidate) => candidate.kind === "deepen" && candidate.question.dimension === "research-literacy"));
});

test("没问过的维度不算缺口，答过但不知道才算", () => {
  const questionnaire = DEMO_QUESTIONNAIRE;

  // 只答了科研认知，而且明确说不知道；其余维度根本没问。
  const partial = scoreFromAnswers(questionnaire, [
    { questionId: "q-research-what", optionIds: [], unknown: true },
  ]);

  assert.deepEqual(partial.unknownDimensions, ["research-literacy"], "只有答过且明确不知道的维度才算缺口");
  assert.equal(partial.answeredCount, 1);
});

test("演示预设答案仍然得到与第一版一致的维度分布", () => {
  const scoring = scoreFromAnswers(DEMO_QUESTIONNAIRE, DEMO_ANSWERS);

  assert.equal(scoring.weeklyHours, 4);
  assert.deepEqual(
    scoring.interests.map((item) => item.id),
    ["it-ai", "it-robotics", "it-data"],
  );
  assert.equal(scoring.unknownDimensions.length, 0);
  assert.equal(scoring.dimensions.every((entry) => entry.level !== "ready"), true);
});

test("每次从题库取到的题号都是真实存在的", () => {
  const { asked } = drain("full", "highest");
  for (const id of asked) {
    assert.ok(QUESTION_BY_ID.has(id), `${id} 不在题库里`);
  }
  void NOW;
});
