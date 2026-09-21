/**
 * 维度指引表（B 负责）—— 画像与路线共用的唯一内容来源。
 *
 * 为什么要共用一份：画像里的「优先行动」要指向路线里的具体任务（`linkedTaskId`），
 * 如果两处各写一份文案，改了一处就会指向不存在的任务。
 * 这里给每个维度定死一个 `task-<dimension>` 的 id，两边都从这里取，就不可能对不上。
 *
 * 文案遵守 PRD §9.3：只描述"现在缺的是哪一块经验"，不评价能力高低，
 * 并且每条缺口都配一个**当天就能做完**的小动作。
 */
import type { AssessmentDimension } from "@/contracts";

/** 参与阶段判定的能力维度。 */
export type AbilityDimension = Exclude<AssessmentDimension, "interest-direction" | "goal-and-time">;

export type TaskSeed = {
  title: string;
  description: string;
  estimatedMinutes: number;
  completionCriteria: string[];
  skippable: boolean;
};

export type DimensionGuidance = {
  /** 等级为 ready / developing 时，作为一条优势展示。 */
  strength: string;
  /** 等级为 unknown（明确选了「不知道」）时，作为一条待补能力。 */
  gapUnknown: string;
  /** 等级为 starting（选了最低档）时，作为一条待补能力。 */
  gapStarting: string;
  /** 缺口对应的下一步小动作，出现在画像页。 */
  nextStep: string;
  /** 路线任务的标题。 */
  actionTitle: string;
  task: TaskSeed;
};

export const ABILITY_DIMENSION_ORDER: AbilityDimension[] = [
  "research-literacy",
  "paper-literacy",
  "information-retrieval",
  "method-basics",
  "skill-basics",
  "action-experience",
];

export const DIMENSION_GUIDANCE: Record<AbilityDimension, DimensionGuidance> = {
  "research-literacy": {
    strength: "你已经能分清「科研」和「单纯整理资料」的区别",
    gapUnknown: "还没形成对「科研到底在做什么」的基本印象",
    gapStarting: "对科研的理解还停在「收集资料、写成报告」这一层",
    nextStep: "找一篇论文，读它的摘要，看看作者到底想回答什么问题",
    actionTitle: "看懂一个真实的研究问题",
    task: {
      title: "看懂一个真实的研究问题",
      description: "选一篇论文的摘要，把它研究的问题抄下来，再写一句它为什么值得研究。",
      estimatedMinutes: 25,
      completionCriteria: ["抄下论文研究的问题", "用自己的话写一句这个问题为什么值得研究"],
      skippable: false,
    },
  },
  "paper-literacy": {
    strength: "你看得出论文由哪几部分组成",
    gapUnknown: "还没接触过一篇论文的组成部分",
    gapStarting: "目前只认得摘要和参考文献这两块",
    nextStep: "打开一篇论文，把「引言／方法／结果／讨论」这四个小标题圈出来",
    actionTitle: "拆解一篇论文的结构",
    task: {
      title: "拆解一篇论文的结构",
      description: "找一篇论文，把各部分标题圈出来，每部分写一句它大概在讲什么。",
      estimatedMinutes: 30,
      completionCriteria: ["圈出引言、方法、结果、讨论四个部分", "每部分写一句话概括它在讲什么"],
      skippable: false,
    },
  },
  "information-retrieval": {
    strength: "你会用学术搜索工具找资料，也看得懂引用信息",
    gapUnknown: "还没用过学术搜索工具",
    gapStarting: "目前主要靠普通搜索引擎找资料",
    nextStep: "用一次学术搜索工具，把前三条结果的标题记下来",
    actionTitle: "用一次学术搜索工具",
    task: {
      title: "用一次学术搜索工具",
      description: "用一个关键词搜一次，把结果列表的前三条标题记下来。",
      estimatedMinutes: 20,
      completionCriteria: ["记录你用的工具名称", "列出三条搜索结果的标题"],
      skippable: true,
    },
  },
  "method-basics": {
    strength: "你能说出几种研究方法各自适合什么场景",
    gapUnknown: "还没接触过具体的研究方法",
    gapStarting: "只模糊知道一两种研究方法",
    nextStep: "挑一种方法，写清它适合回答什么样的问题",
    actionTitle: "认识三种研究方法",
    task: {
      title: "认识三种研究方法",
      description: "查一查常见研究方法，挑三种各写一句它适合回答的问题类型。",
      estimatedMinutes: 30,
      completionCriteria: ["写出三种研究方法的名称", "每种各写一句它适合回答什么问题"],
      skippable: true,
    },
  },
  "skill-basics": {
    strength: "编程与英文阅读已经开始能支撑你读一点材料",
    gapUnknown: "编程或英文阅读还没开始积累",
    gapStarting: "编程和英文阅读都还在起步阶段",
    nextStep: "把一篇论文的摘要逐句读一遍，把不认识的词标出来",
    actionTitle: "读通一篇论文摘要",
    task: {
      title: "读通一篇论文摘要",
      description: "逐句读完一篇摘要，标出不认识的术语，逐个查清含义。",
      estimatedMinutes: 25,
      completionCriteria: ["逐句读完一篇摘要", "标出至少三个不认识的术语并查出含义"],
      skippable: true,
    },
  },
  "action-experience": {
    strength: "你已经有过真实的科研相关经历",
    gapUnknown: "还没有当过科研活动的参与者",
    gapStarting: "听过讲座或分享，但还没真正上手做过一件具体的事",
    nextStep: "写一份自己的经历清单，哪怕只有课程作业也算",
    actionTitle: "列出你的经历清单",
    task: {
      title: "列出你的经历清单",
      description: "把自己做过的课程作业、比赛、项目写下来，每条写清你具体负责了什么。",
      estimatedMinutes: 20,
      completionCriteria: ["写下三条自己做过的课程或项目经历", "每条写清你负责的具体部分"],
      skippable: false,
    },
  },
};

/** 不管测评结果如何都给的一条兜底优势：避免优势条目少于 PRD 要求的 2 条。 */
export const BASELINE_STRENGTH = "你愿意花时间认真了解科研，这本身就是起点";

/** 偏好维度（兴趣方向）对应的探索任务，与任何能力维度无关。 */
export const INTEREST_TASK: TaskSeed = {
  title: "认识一个你感兴趣的方向",
  description: "从你选的方向里挑一个，找一位做这个方向的老师主页，看他在研究什么。",
  estimatedMinutes: 25,
  completionCriteria: ["选一个方向，找到一位相关老师的主页", "写下他研究里的两个关键词"],
  skippable: true,
};

/** 目标与时间对应的任务：把模糊的"想做科研"变成一句可判断的话。 */
export const GOAL_TASK: TaskSeed = {
  title: "把目标写成一句可判断的话",
  description: "写一句三周内能完成的目标，并标注你打算每周投入多少时间。",
  estimatedMinutes: 15,
  completionCriteria: ["写下一句三周内可完成的目标", "标注每周打算投入的小时数"],
  skippable: false,
};

/** 任务 id 约定：能力维度用 `task-<dimension>`，偏好维度用下面两个固定 id。 */
export const INTEREST_TASK_ID = "task-interest";
export const GOAL_TASK_ID = "task-goal";

export function taskIdOf(dimension: AbilityDimension): string {
  return `task-${dimension}`;
}

export function actionIdOf(dimension: AbilityDimension): string {
  return `action-${dimension}`;
}
