/**
 * 评分纯函数测试（B 负责）。
 *
 * 这些用例针对的是"结论对不对"，不是"代码跑不跑得起来"：
 * 尤其是「不知道」与"选了最低档"必须给出两种不同结论 ——
 * 前者要补的是认知，后者要补的是练习，给错方向就等于把人劝退了。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AssessmentAnswer, AssessmentQuestion } from "../../contracts/assessment.ts";
import { DEMO_ANSWERS, DEMO_QUESTIONNAIRE, FULL_QUESTIONNAIRE } from "./question-bank.ts";
import { buildSubmission, findUnansweredQuestions, levelOf, scoreAssessment } from "./scoring.ts";

const NOW = "2026-09-20T20:00:00+08:00";

function answer(questionId: string, optionIds: string[]): AssessmentAnswer {
  return { questionId, optionIds, unknown: false };
}

function unknownAnswer(questionId: string): AssessmentAnswer {
  return { questionId, optionIds: [], unknown: true };
}

function questionById(id: string): AssessmentQuestion {
  const found = FULL_QUESTIONNAIRE.questions.find((question) => question.id === id);
  if (!found) throw new Error(`测试引用了不存在的题目：${id}`);
  return found;
}

/** 分数全为 null 的题（兴趣、时间、目标）取第一个选项。 */
function extremeOption(question: AssessmentQuestion, highest: boolean): string {
  const scored = question.options.filter((option) => option.score !== null);
  if (scored.length === 0) return question.options[0].id;

  return scored.reduce((best, option) => {
    const better = highest ? (option.score ?? 0) > (best.score ?? 0) : (option.score ?? 0) < (best.score ?? 0);
    return better ? option : best;
  }).id;
}

function allAnswers(level: "highest" | "lowest"): AssessmentAnswer[] {
  return FULL_QUESTIONNAIRE.questions.map((question) =>
    answer(question.id, [extremeOption(question, level === "highest")]),
  );
}

function withOverride(answers: AssessmentAnswer[], override: AssessmentAnswer): AssessmentAnswer[] {
  return answers.map((item) => (item.questionId === override.questionId ? override : item));
}

/** 一次替换多道题的作答（同一维度现在可能有多道题）。 */
function withAll(answers: AssessmentAnswer[], overrides: AssessmentAnswer[]): AssessmentAnswer[] {
  return overrides.reduce((accumulated, override) => withOverride(accumulated, override), answers);
}

function score(answers: AssessmentAnswer[], questionnaire = FULL_QUESTIONNAIRE) {
  return scoreAssessment(questionnaire, buildSubmission(questionnaire, answers, NOW));
}

function dimensionOf(scoring: ReturnType<typeof score>, dimension: string) {
  return scoring.dimensions.find((entry) => entry.dimension === dimension);
}

test("等级阈值：3 分已经能做、1.5 分有一点基础、1 分起步、0 分仍在起步", () => {
  assert.equal(levelOf(3), "ready");
  assert.equal(levelOf(2.5), "ready");
  assert.equal(levelOf(2), "developing");
  assert.equal(levelOf(1.5), "developing");
  assert.equal(levelOf(1), "starting");
  assert.equal(levelOf(0), "starting");
  assert.equal(levelOf(null), "unknown");
});

test("明确选「不知道」记为 unknown，而不是 0 分", () => {
  // method-basics 现在有两道题（核心题 + 深入题），要都答"不知道"这个维度才是 unknown。
  const scoring = score(
    withAll(allAnswers("highest"), [unknownAnswer("q-method-kinds"), unknownAnswer("q-method-design")]),
  );
  const method = dimensionOf(scoring, "method-basics");

  assert.equal(method?.level, "unknown");
  assert.equal(method?.score, null);
  assert.equal(method?.unknownDeclared, true);
  assert.ok(scoring.unknownDimensions.includes("method-basics"));
});

test("选了最低档记为 starting，与「不知道」是两种结论", () => {
  const scoring = score(
    withAll(allAnswers("highest"), [
      answer("q-method-kinds", [extremeOption(questionById("q-method-kinds"), false)]),
      answer("q-method-design", [extremeOption(questionById("q-method-design"), false)]),
    ]),
  );
  const method = dimensionOf(scoring, "method-basics");

  assert.equal(method?.level, "starting");
  assert.equal(method?.score, 1);
  assert.equal(method?.unknownDeclared, false);
  assert.ok(!scoring.unknownDimensions.includes("method-basics"));
});

test("兴趣与时间不计分，也不会被算成能力缺口", () => {
  let answers = withOverride(allAnswers("highest"), answer("q-interest", ["it-ai", "it-robotics"]));
  answers = withOverride(answers, answer("q-time", ["time-6-10"]));
  const scoring = score(answers);

  assert.deepEqual(
    scoring.interests.map((item) => item.id),
    ["it-ai", "it-robotics"],
  );
  assert.equal(scoring.weeklyHours, 8);

  const interest = dimensionOf(scoring, "interest-direction");
  assert.equal(interest?.kind, "preference");
  assert.equal(interest?.score, null);
  assert.ok(!scoring.unknownDimensions.includes("interest-direction"));

  // 偏好维度不计分，所以不会把能力维度拉低。
  assert.equal(dimensionOf(scoring, "paper-literacy")?.level, "ready");
});

test("必答题未作答能被找出，且「明确不知道」不算漏答", () => {
  const partial = allAnswers("highest").filter(
    (item) => item.questionId !== "q-exp-paper" && item.questionId !== "q-goal",
  );
  assert.deepEqual(findUnansweredQuestions(FULL_QUESTIONNAIRE, partial), ["q-exp-paper", "q-goal"]);

  const withUnknown = [...partial, unknownAnswer("q-interest")];
  assert.deepEqual(findUnansweredQuestions(FULL_QUESTIONNAIRE, withUnknown), ["q-exp-paper", "q-goal"]);

  const alsoGoalUnknown = [...withUnknown, unknownAnswer("q-goal")];
  assert.deepEqual(findUnansweredQuestions(FULL_QUESTIONNAIRE, alsoGoalUnknown), ["q-exp-paper"]);
});

test("全选最高档与全选最低档得到明显不同的维度分布", () => {
  const high = score(allAnswers("highest"));
  const low = score(allAnswers("lowest"));

  const highReady = high.abilityDimensions.filter((entry) => entry.level === "ready").length;
  const lowReady = low.abilityDimensions.filter((entry) => entry.level === "ready").length;

  assert.equal(highReady, high.abilityDimensions.length);
  assert.equal(lowReady, 0);
  assert.equal(high.unknownDimensions.length, 0);
});

test("演示答案在演示问卷上结果可复现，且与全量问卷题量不同", () => {
  const first = score(DEMO_ANSWERS, DEMO_QUESTIONNAIRE);
  const second = score(DEMO_ANSWERS, DEMO_QUESTIONNAIRE);

  assert.deepEqual(first, second);
  assert.equal(DEMO_QUESTIONNAIRE.questions.length, 8, "演示版只保留核心题与偏好题");
  assert.equal(FULL_QUESTIONNAIRE.questions.length, 15, "全量题库含 6 道深入题");
  assert.equal(first.weeklyHours, 4);
  assert.deepEqual(
    first.interests.map((item) => item.label),
    ["人工智能", "机器人", "数据科学"],
  );
  assert.equal(first.unknownDimensions.length, 0);
});

test("每题都有选项，认知题都提供「不知道」", () => {
  for (const question of FULL_QUESTIONNAIRE.questions) {
    assert.ok(question.options.length >= 2, `${question.id} 选项太少`);
    assert.ok(question.required, `${question.id} 应为必答`);
    if (question.dimension !== "interest-direction" && question.id !== "q-goal" && question.id !== "q-time") {
      assert.equal(question.allowUnknown, true, `${question.id} 是认知题，应提供「不知道」`);
    }
  }
});
