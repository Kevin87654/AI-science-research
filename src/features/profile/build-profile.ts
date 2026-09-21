/**
 * 画像生成（B 负责）—— 纯函数，测评结果进、`Profile` 出。
 *
 * 阶段判定只看**能力维度**，不看兴趣与目标：阶段表达的是"你现在能做多少"，
 * 把"对 AI 感兴趣"算成能力会把结论拔高，把"还没想好方向"算成短板又会把它压低，
 * 两种失真都违背 PRD §9.3 的表达原则。
 *
 * 判定规则（写死在这里，便于向用户解释，也便于测试）：
 * - 初步实践期：至少 3 个能力维度达到「已经能做」，且行动经历也达到该档；
 * - 入门准备期：至少 3 个能力维度达到「有一点」以上；
 * - 科研观察期：其余情况。
 */
import type { InterestTag, Profile, ProfileAction, ResearchStage, ResearchStageCode } from "@/contracts";
// 相对路径 + `.ts` 后缀：让 `pnpm test` 的 node --test 能直接加载（纯函数要能脱离 Next 验证）。
import type { AssessmentScoring, DimensionScore } from "../assessment/scoring.ts";
import { DIMENSION_LABELS } from "../assessment/question-bank.ts";
import {
  ABILITY_DIMENSION_ORDER,
  BASELINE_STRENGTH,
  DIMENSION_GUIDANCE,
  GOAL_TASK_ID,
  INTEREST_TASK_ID,
  actionIdOf,
  taskIdOf,
  type AbilityDimension,
} from "../guidance/dimension-guidance.ts";

const SCHEMA_VERSION = "1.0.0";

type StageDefinition = ResearchStage & { summary: string };

const STAGES: Record<ResearchStageCode, StageDefinition> = {
  "research-observation": {
    code: "research-observation",
    label: "科研观察期",
    summary:
      "你已经开始注意科研这件事，但还没有把兴趣落到具体的「读一篇」或「做一件」上。这个阶段最有效的动作很小：读完一篇摘要、用一次学术搜索工具，画像就会明显变化。",
  },
  "entry-preparation": {
    code: "entry-preparation",
    label: "入门准备期",
    summary:
      "你在几个方向上已经积累了一点基础，缺的是把零散的认识串成一次完整经历。下一步适合挑一个方向，走完「找资料 → 读懂 → 说清问题」这一条链。",
  },
  "early-practice": {
    code: "early-practice",
    label: "初步实践期",
    summary:
      "你已经有过真实的科研相关经历，也具备基本的方法与工具基础。接下来更适合把范围收窄，准备一次更具体的接触，比如完整读一篇论文或和对口的老师聊一次。",
  },
};

/** 兜底缺口：能力维度全部达标时仍需给出可执行的下一步，不能让"待补能力"为空。 */
const FALLBACK_GAPS = [
  "还没有把学到的知识用在一次完整的小研究里",
  "还没和在做的老师或学长认真聊过一次",
];

export type BuildProfileInput = {
  /** 服务端会话确认的用户标识。本地生成画像时也必须传真实会话值。 */
  userId: string;
  /** 可追溯的测评提交标识。 */
  submissionId: string;
  scoring: AssessmentScoring;
  generatedAt: string;
  isDemo: boolean;
};

function abilityScoreOf(scoring: AssessmentScoring, dimension: AbilityDimension): DimensionScore | undefined {
  return scoring.abilityDimensions.find((entry) => entry.dimension === dimension);
}

export function decideStage(scoring: AssessmentScoring): ResearchStageCode {
  const ready = scoring.abilityDimensions.filter((entry) => entry.level === "ready");
  const developingOrBetter = scoring.abilityDimensions.filter(
    (entry) => entry.level === "ready" || entry.level === "developing",
  );
  const experience = abilityScoreOf(scoring, "action-experience");

  if (ready.length >= 3 && experience?.level === "ready") return "early-practice";
  if (developingOrBetter.length >= 3) return "entry-preparation";
  return "research-observation";
}

/** 优势按"先看等级、再看分数"排序，保证最强的两条排在最前面。 */
function rankStrengths(entries: DimensionScore[]): DimensionScore[] {
  const weight = (entry: DimensionScore) => (entry.level === "ready" ? 0 : 1);
  return [...entries].sort((a, b) => {
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

/** 缺口把"明确不知道"排在前面——它更需要先补认知，而不是先练技巧。 */
function rankGaps(entries: DimensionScore[]): DimensionScore[] {
  const weight = (entry: DimensionScore) => (entry.level === "unknown" ? 0 : 1);
  return [...entries].sort((a, b) => {
    const diff = weight(a) - weight(b);
    if (diff !== 0) return diff;
    return (a.score ?? 0) - (b.score ?? 0);
  });
}

function buildStrengths(scoring: AssessmentScoring): string[] {
  const strongEntries = rankStrengths(
    scoring.abilityDimensions.filter((entry) => entry.level === "ready" || entry.level === "developing"),
  );

  const strengths = strongEntries
    .slice(0, 4)
    .map((entry) => DIMENSION_GUIDANCE[entry.dimension as AbilityDimension].strength);

  if (scoring.interests.length > 0) {
    const labels = scoring.interests.map((interest) => interest.label).join("、");
    strengths.push(`你已经说出了自己想了解的方向：${labels}`);
  }

  if (strengths.length < 2) strengths.push(BASELINE_STRENGTH);
  return strengths.slice(0, 5);
}

function buildGaps(scoring: AssessmentScoring): string[] {
  const weakEntries = rankGaps(
    scoring.abilityDimensions.filter((entry) => entry.level === "unknown" || entry.level === "starting"),
  );

  const gaps = weakEntries.map((entry) => {
    const guidance = DIMENSION_GUIDANCE[entry.dimension as AbilityDimension];
    return entry.level === "unknown" ? guidance.gapUnknown : guidance.gapStarting;
  });

  for (const fallback of FALLBACK_GAPS) {
    if (gaps.length >= 2) break;
    if (!gaps.includes(fallback)) gaps.push(fallback);
  }

  return gaps.slice(0, 5);
}

/** 行动建议里对维度的措辞，随等级变化，避免把「有一点基础」说成「还没接触」。 */
const ACTION_REASON: Record<DimensionScore["level"], string> = {
  unknown: "还没建立起基本印象",
  starting: "还停在起步阶段",
  developing: "已经有了一点基础，正好再往前推一步",
  ready: "已经能做，可以换成更高难度的练法",
};

function buildPriorityActions(scoring: AssessmentScoring): ProfileAction[] {
  const candidates = rankGaps(
    scoring.abilityDimensions.filter((entry) => entry.level === "unknown" || entry.level === "starting"),
  );

  // 缺口不足 3 条时，把「有一点基础」的维度也算进来：
  // 它们同样有可推进的下一步，否则基础较好的用户会拿到少于 PRD 要求的 3 条行动。
  if (candidates.length < 3) {
    candidates.push(...rankStrengths(scoring.abilityDimensions.filter((entry) => entry.level === "developing")));
  }

  const actions: ProfileAction[] = candidates.slice(0, 3).map((entry) => {
    const dimension = entry.dimension as AbilityDimension;
    const guidance = DIMENSION_GUIDANCE[dimension];
    const label = DIMENSION_LABELS[dimension];

    return {
      id: actionIdOf(dimension),
      title: guidance.actionTitle,
      rationale: `「${label}」${ACTION_REASON[entry.level]}，先做这一件：${guidance.nextStep}`,
      linkedTaskId: taskIdOf(dimension),
    };
  });

  if (actions.length < 3) {
    actions.push({
      id: "action-interest",
      title: "认识一个你感兴趣的方向",
      rationale:
        scoring.interests.length > 0
          ? `你已经选了「${scoring.interests.map((interest) => interest.label).join("、")}」，找一位对口老师的主页看看他在做什么。`
          : "先看一位老师的主页，比空想方向更容易确认自己喜欢什么。",
      linkedTaskId: INTEREST_TASK_ID,
    });
  }

  if (actions.length < 3) {
    actions.push({
      id: "action-goal",
      title: "把目标写成一句可判断的话",
      rationale: `你每周大概能投入 ${scoring.weeklyHours ?? "几"} 小时，把它写成一句三周内能完成的目标，路线才好排。`,
      linkedTaskId: GOAL_TASK_ID,
    });
  }

  // 最后一条兜底行动**刻意不挂路线任务**：它是一次真实对话，不是路线里的一项练习。
  // 契约里 `linkedTaskId` 本来就可空，这里正是它存在的意义。
  if (actions.length < 3) {
    actions.push({
      id: "action-talk",
      title: "找一位在做的学长学姐聊十分钟",
      rationale: "你的基础已经不错，最快确认方向的方式是直接问一个正在做的人：他一天在做什么、最枯燥的部分是什么。",
      linkedTaskId: null,
    });
  }

  return actions.slice(0, 3);
}

function buildBasis(scoring: AssessmentScoring): string {
  const levelLabels: Record<DimensionScore["level"], string> = {
    unknown: "还没接触过",
    starting: "刚开始了解",
    developing: "有一点基础",
    ready: "已经能做",
  };

  const parts = ABILITY_DIMENSION_ORDER.map((dimension) => {
    const entry = abilityScoreOf(scoring, dimension);
    const label = DIMENSION_LABELS[dimension];
    return `${label}${entry ? levelLabels[entry.level] : "未作答"}`;
  });

  const tail: string[] = [];
  tail.push(`兴趣方向勾选了 ${scoring.interests.length > 0 ? scoring.interests.map((i) => i.label).join("、") : "暂时没有"}`);
  tail.push(scoring.weeklyHours === null ? "未填写每周时间" : `每周可投入约 ${scoring.weeklyHours} 小时`);

  return `依据测评的六个能力维度：${parts.join("；")}。${tail.join("；")}。画像是把这一次作答翻译成行动建议，不是对你的能力下结论。`;
}

function buildSummary(stage: StageDefinition, scoring: AssessmentScoring): string {
  const parts = [stage.summary];

  if (scoring.interests.length > 0) {
    parts.push(`你勾选的方向是「${scoring.interests.map((interest) => interest.label).join("、")}」，下面的任务会围绕它展开。`);
  } else {
    parts.push("你还没有勾选具体方向，先通过一次真实的阅读来找感觉，比反复纠结选哪个更有效。");
  }

  return parts.join("");
}

export function buildProfile(input: BuildProfileInput): Profile {
  const stageCode = decideStage(input.scoring);
  const stage = STAGES[stageCode];

  const interests: InterestTag[] = input.scoring.interests.map((interest) => ({
    id: interest.id,
    label: interest.label,
    source: "derived",
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: `profile-${input.submissionId}`,
    userId: input.userId,
    stage: { code: stage.code, label: stage.label },
    summary: buildSummary(stage, input.scoring),
    strengths: buildStrengths(input.scoring),
    gaps: buildGaps(input.scoring),
    interests,
    priorityActions: buildPriorityActions(input.scoring),
    basis: buildBasis(input.scoring),
    sourceSubmissionId: input.submissionId,
    generatedAt: input.generatedAt,
    isDemo: input.isDemo,
  };
}
