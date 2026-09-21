/**
 * 学习路线生成（B 负责）—— 纯函数，画像进、`Roadmap` 出。
 *
 * 排路线的两条规则：
 *
 * 1. **已经能做到的维度不再安排任务**（等级 `ready` 跳过），
 *    否则"推荐"会变成重复劳动，用户第二次打开就不想看了。
 * 2. **建议周期不许短于阶段数** —— 每个阶段至少给一周，
 *    否则按"总耗时 ÷ 每周时间"算出来的数字会小到不可信（例如 250 分钟 ÷ 4 小时 = 1 周）。
 *
 * 任务 id 由 `task-<dimension>` 约定生成，与画像里的 `linkedTaskId` 一一对应。
 */
import type { Roadmap, RoadmapStage, RoadmapTask } from "@/contracts";
// 相对路径 + `.ts` 后缀：让 `pnpm test` 的 node --test 能直接加载（纯函数要能脱离 Next 验证）。
import type { AssessmentScoring, DimensionScore } from "../assessment/scoring.ts";
import { DEFAULT_WEEKLY_HOURS } from "../assessment/question-bank.ts";
import {
  DIMENSION_GUIDANCE,
  GOAL_TASK,
  GOAL_TASK_ID,
  INTEREST_TASK,
  INTEREST_TASK_ID,
  taskIdOf,
  type AbilityDimension,
  type TaskSeed,
} from "../guidance/dimension-guidance.ts";

const SCHEMA_VERSION = "1.0.0";

const STAGE_AWARENESS = "stage-awareness";
const STAGE_PRACTICE = "stage-practice";
const STAGE_ACTION = "stage-action";

/** 每个阶段该放哪些维度的任务。顺序即展示顺序。 */
const STAGE_PLAN: Array<{ id: string; title: string; description: string; dimensions: AbilityDimension[] }> = [
  {
    id: STAGE_AWARENESS,
    title: "先看真实的东西",
    description: "用真实论文建立直觉。这一步不要求你懂方法，只要求你看过。",
    dimensions: ["research-literacy", "paper-literacy"],
  },
  {
    id: STAGE_PRACTICE,
    title: "动手练一次",
    description: "把「听说过」变成「做过一次」。每项任务都有可勾选的完成标准。",
    dimensions: ["information-retrieval", "method-basics", "skill-basics"],
  },
  {
    id: STAGE_ACTION,
    title: "准备第一次行动",
    description: "把已有经历整理清楚，确定下一步找谁、说什么。",
    dimensions: ["action-experience"],
  },
];

export type PlanRoadmapInput = {
  userId: string;
  /** 依据哪份画像生成，对应 `Roadmap.profileId`。 */
  profileId: string;
  scoring: AssessmentScoring;
  createdAt: string;
  isDemo: boolean;
};

function findScore(scoring: AssessmentScoring, dimension: AbilityDimension): DimensionScore | undefined {
  return scoring.abilityDimensions.find((entry) => entry.dimension === dimension);
}

/** 等级为 ready 的维度视为已具备，不再排任务。 */
function needsWork(scoring: AssessmentScoring, dimension: AbilityDimension): boolean {
  const entry = findScore(scoring, dimension);
  if (!entry) return true;
  return entry.level !== "ready";
}

function toTask(
  seed: TaskSeed,
  id: string,
  stageId: string,
  order: number,
): RoadmapTask {
  return {
    id,
    stageId,
    order,
    title: seed.title,
    description: seed.description,
    estimatedMinutes: seed.estimatedMinutes,
    completionCriteria: seed.completionCriteria,
    // C 的资料接入主工程后再填真实 id；现在留空，界面会优雅降级。
    resourceIds: [],
    skippable: seed.skippable,
  };
}

function buildRoadmapTitle(scoring: AssessmentScoring): string {
  const first = scoring.interests[0];
  return first ? `${first.label}方向的第一段路` : "认识科研的第一步";
}

function buildGoal(scoring: AssessmentScoring): string {
  const goals: Record<string, string> = {
    "goal-understand": "搞清科研到底在做什么，并完整看过一篇真实论文的摘要与结构。",
    "goal-direction": "确认一个自己真正想了解的方向，并知道这个方向在做什么。",
    "goal-read": "完整读完一篇论文，能说清它研究的问题、方法和结论。",
    "goal-lab": "整理好自己的经历清单，知道该找什么方向的老师、开口说什么。",
  };

  if (scoring.goalOptionId && goals[scoring.goalOptionId]) return goals[scoring.goalOptionId];
  return "用几周时间完成几个具体的小任务，判断自己要不要继续往科研方向走。";
}

export function planRoadmap(input: PlanRoadmapInput): Roadmap {
  const { scoring } = input;
  const stages: RoadmapStage[] = [];
  const tasks: RoadmapTask[] = [];

  for (const plan of STAGE_PLAN) {
    const stageTasks: RoadmapTask[] = [];

    for (const dimension of plan.dimensions) {
      if (!needsWork(scoring, dimension)) continue;
      stageTasks.push(toTask(DIMENSION_GUIDANCE[dimension].task, taskIdOf(dimension), plan.id, stageTasks.length + 1));
    }

    // 兴趣探索任务挂在「动手练一次」阶段：它同样是"做一件具体的事"。
    if (plan.id === STAGE_PRACTICE) {
      stageTasks.push(toTask(INTEREST_TASK, INTEREST_TASK_ID, plan.id, stageTasks.length + 1));
    }

    if (plan.id === STAGE_ACTION) {
      stageTasks.push(toTask(GOAL_TASK, GOAL_TASK_ID, plan.id, stageTasks.length + 1));
    }

    if (stageTasks.length === 0) continue;

    stages.push({
      id: plan.id,
      order: stages.length + 1,
      title: plan.title,
      description: plan.description,
      taskIds: stageTasks.map((task) => task.id),
    });
    tasks.push(...stageTasks);
  }

  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  const weeklyHours = scoring.weeklyHours ?? DEFAULT_WEEKLY_HOURS;
  const weeksByTime = Math.ceil(totalMinutes / Math.max(1, weeklyHours * 60));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: `roadmap-${input.profileId}`,
    userId: input.userId,
    profileId: input.profileId,
    title: buildRoadmapTitle(scoring),
    goal: buildGoal(scoring),
    // 每个阶段至少一周，避免算出"三天就能做完"这种不可信的数字。
    suggestedWeeks: Math.max(stages.length, weeksByTime, 1),
    stages,
    tasks,
    generatedAt: input.createdAt,
    isDemo: input.isDemo,
  };
}

/** 路线总耗时（分钟），供界面展示。 */
export function totalEstimatedMinutes(roadmap: Roadmap): number {
  return roadmap.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
}
