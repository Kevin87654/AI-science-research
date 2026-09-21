/**
 * 画像与路线测试（B 负责）。
 *
 * 重点验证两件容易做错、用户又立刻能感觉到的事：
 * 1. **强基础的用户不该被安排他早就会做的任务**（否则第二次打开就不想看了）；
 * 2. **画像里的「优先行动」必须真的能在路线里找到对应任务** —— 两边靠 `task-<维度>` 这个
 *    id 约定对齐，一旦谁改了文案或 id，这个用例会立刻失败。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { AssessmentAnswer, AssessmentQuestion, AssessmentQuestionnaire } from "../../contracts/assessment.ts";
import { DEMO_ANSWERS, DEMO_QUESTIONNAIRE, FULL_QUESTIONNAIRE } from "../assessment/question-bank.ts";
import { buildSubmission, scoreAssessment } from "../assessment/scoring.ts";
import { buildProfile } from "../profile/build-profile.ts";
import { planRoadmap, totalEstimatedMinutes } from "./plan-roadmap.ts";

const NOW = "2026-09-20T20:00:00+08:00";
const USER_ID = "test-user-0001";

function answer(questionId: string, optionIds: string[]): AssessmentAnswer {
  return { questionId, optionIds, unknown: false };
}

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

/** 用一组答案走完 测评 → 画像 → 路线 三步。 */
function runFlow(answers: AssessmentAnswer[], questionnaire: AssessmentQuestionnaire = FULL_QUESTIONNAIRE, isDemo = false) {
  const submission = buildSubmission(questionnaire, answers, NOW);
  const scoring = scoreAssessment(questionnaire, submission);
  const submissionId = "sub-test-0001";

  const profile = buildProfile({ userId: USER_ID, submissionId, scoring, generatedAt: NOW, isDemo });
  const roadmap = planRoadmap({
    userId: USER_ID,
    profileId: profile.id,
    scoring,
    createdAt: NOW,
    isDemo,
  });

  return { scoring, profile, roadmap };
}

test("阶段判定：全选最高档进入初步实践期，全选最低档停在科研观察期", () => {
  assert.equal(runFlow(allAnswers("highest")).profile.stage.code, "early-practice");
  assert.equal(runFlow(allAnswers("lowest")).profile.stage.code, "research-observation");

  // 演示用户（编程刚起步、没读过论文）同样属于观察期。
  assert.equal(runFlow(DEMO_ANSWERS, DEMO_QUESTIONNAIRE, true).profile.stage.code, "research-observation");
});

test("画像的优先行动必须能在路线里找到对应任务，或明确不挂任务", () => {
  for (const flow of [
    runFlow(allAnswers("highest")),
    runFlow(allAnswers("lowest")),
    runFlow(DEMO_ANSWERS, DEMO_QUESTIONNAIRE, true),
  ]) {
    assert.equal(flow.profile.priorityActions.length, 3, "PRD §9.2 要求 3 条优先行动");

    const taskIds = new Set(flow.roadmap.tasks.map((task) => task.id));
    for (const action of flow.profile.priorityActions) {
      if (action.linkedTaskId === null || action.linkedTaskId === undefined) continue;
      assert.ok(taskIds.has(action.linkedTaskId), `行动 ${action.id} 指向了路线里不存在的任务`);
    }
  }
});

test("优势与待补能力数量落在 PRD 要求的 2～5 项", () => {
  for (const flow of [
    runFlow(allAnswers("highest")),
    runFlow(allAnswers("lowest")),
    runFlow(DEMO_ANSWERS, DEMO_QUESTIONNAIRE, true),
  ]) {
    assert.ok(flow.profile.strengths.length >= 2 && flow.profile.strengths.length <= 5);
    assert.ok(flow.profile.gaps.length >= 2 && flow.profile.gaps.length <= 5);
    assert.ok(flow.profile.basis.length > 0, "画像必须说明生成依据");
  }
});

test("等级为 ready 的维度不再排任务", () => {
  const flow = runFlow(allAnswers("highest"));
  const taskIds = flow.roadmap.tasks.map((task) => task.id);

  for (const dimension of ["research-literacy", "paper-literacy", "information-retrieval", "method-basics", "skill-basics", "action-experience"]) {
    assert.ok(!taskIds.includes(`task-${dimension}`), `${dimension} 已经能做到，不该再排任务`);
  }

  // 只剩兴趣探索与目标两条任务。
  assert.deepEqual(taskIds, ["task-interest", "task-goal"]);
});

test("没达到 ready 的能力维度都会排到任务，且建议周期不短于阶段数", () => {
  const flow = runFlow(DEMO_ANSWERS, DEMO_QUESTIONNAIRE, true);
  const taskIds = new Set(flow.roadmap.tasks.map((task) => task.id));

  const needsWork = flow.scoring.abilityDimensions.filter((entry) => entry.level !== "ready");
  assert.equal(needsWork.length, 6, "演示用户六个能力维度都还没到 ready");

  for (const entry of needsWork) {
    assert.ok(taskIds.has(`task-${entry.dimension}`), `${entry.dimension} 还没做到，应该排任务`);
  }

  assert.ok(flow.roadmap.tasks.length >= 6);
  assert.ok(
    flow.roadmap.suggestedWeeks >= flow.roadmap.stages.length,
    "每个阶段至少一周，否则算出来的周期会小到不可信",
  );
});

test("每项任务都有预计耗时与至少一条完成标准（PRD §10.3）", () => {
  const flow = runFlow(allAnswers("lowest"));

  for (const task of flow.roadmap.tasks) {
    assert.ok(task.estimatedMinutes > 0, `${task.id} 缺少预计耗时`);
    assert.ok(task.completionCriteria.length >= 1, `${task.id} 缺少完成标准`);
    assert.ok(task.title.length > 0);
    assert.ok(task.description.length > 0);
  }

  assert.equal(totalEstimatedMinutes(flow.roadmap), flow.roadmap.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0));
});

test("阶段的 taskIds 与任务列表一致，顺序不重复", () => {
  const flow = runFlow(allAnswers("lowest"));
  const allTaskIds = flow.roadmap.tasks.map((task) => task.id);

  for (const stage of flow.roadmap.stages) {
    for (const taskId of stage.taskIds) {
      assert.ok(allTaskIds.includes(taskId), `阶段 ${stage.id} 引用了不存在的任务`);
    }
  }

  assert.equal(new Set(allTaskIds).size, allTaskIds.length, "任务 id 不能重复");

  for (const stage of flow.roadmap.stages) {
    for (const task of flow.roadmap.tasks.filter((item) => item.stageId === stage.id)) {
      assert.ok(stage.taskIds.includes(task.id), `任务 ${task.id} 没被挂进它所属的阶段`);
    }
  }
});

test("演示数据带演示标记，真实测评不带", () => {
  const demo = runFlow(DEMO_ANSWERS, DEMO_QUESTIONNAIRE, true);
  assert.equal(demo.profile.isDemo, true);
  assert.equal(demo.roadmap.isDemo, true);
  assert.ok(demo.profile.id.length > 0);
  assert.equal(demo.roadmap.profileId, demo.profile.id);

  const real = runFlow(allAnswers("highest"));
  assert.equal(real.profile.isDemo, false);
  assert.equal(real.roadmap.isDemo, false);
});
