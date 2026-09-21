/**
 * 自适应选题（B 负责）—— **纯函数，不碰网络**。
 *
 * 它有两个身份：
 * 1. **规则引擎**：没有配置 AI 时，整个测评就靠它逐题推进（不配密钥也能跑通）。
 * 2. **AI 的候选清单 + 兜底**：服务端把 `rankCandidates` 的结果交给模型，让模型在
 *    这些候选里挑；模型超时、返回非法题号、或干脆没配密钥时，直接取候选里的第一个。
 *
 * 两条刻意的规则：
 *
 * - **核心题不受题量上限约束**：每个维度都必须拿到一个结论，否则画像里会出现
 *   "因为没被问到所以算你不会"的假缺口。自适应省的是**深入题**，不是覆盖面。
 * - **答得稳才深挖**：核心题得分达到阈值才追加一道深入题，用于分开"有一点基础"和
 *   "已经能做"；答得浅的维度不再追问 —— 那只会让人觉得在被考。
 */
import type {
  AssessmentAnswer,
  AssessmentDimension,
  AssessmentMode,
  AssessmentQuestion,
  AssessmentStep,
  AssessmentStepProgress,
} from "@/contracts";
// 相对路径 + `.ts` 后缀：让 `pnpm test` 的 node --test 能直接加载（纯函数要能脱离 Next 验证）。
import {
  CORE_QUESTIONS,
  DEEPEN_QUESTIONS,
  DIMENSION_LABELS,
  QUESTION_LEVEL,
  getQuestionnaire,
  isAvailableInMode,
} from "./question-bank.ts";
import { scoreFromAnswers, type AssessmentScoring } from "./scoring.ts";

/** 每个模式最多追问几道深入题（核心题不计入）。 */
export const DEEPEN_BUDGET: Record<AssessmentMode, number> = { full: 3, demo: 0 };

/** 核心题平均分达到这个水平，才值得再深挖一道。 */
export const DEEPEN_THRESHOLD = 2;

/** 问核心题的顺序：先认知，再方法技能，最后经历与偏好。 */
const DIMENSION_ORDER: AssessmentDimension[] = [
  "research-literacy",
  "paper-literacy",
  "information-retrieval",
  "method-basics",
  "skill-basics",
  "action-experience",
  "interest-direction",
  "goal-and-time",
];

export type PlanInput = {
  mode: AssessmentMode;
  answers: AssessmentAnswer[];
  askedQuestionIds: string[];
};

export type QuestionCandidate = {
  question: AssessmentQuestion;
  /** 为什么问这一题，会展示给用户，也作为"可解释"的一部分。 */
  reason: string;
  kind: "core" | "deepen";
};

export type RankingResult = {
  /** 按优先级排好的候选；为空表示可以出画像了。 */
  candidates: QuestionCandidate[];
  doneReason: string;
  progress: AssessmentStepProgress;
};

function isAnswered(answer: AssessmentAnswer | undefined): boolean {
  if (!answer) return false;
  return answer.optionIds.length > 0 || answer.unknown;
}

function dimensionRank(dimension: AssessmentDimension): number {
  const index = DIMENSION_ORDER.indexOf(dimension);
  return index === -1 ? DIMENSION_ORDER.length : index;
}

function labelOf(dimension: AssessmentDimension): string {
  return DIMENSION_LABELS[dimension];
}

/** 该维度下、在当前模式里可用的核心题。 */
function coreQuestionIdsOf(dimension: AssessmentDimension, mode: AssessmentMode): string[] {
  return CORE_QUESTIONS.filter(
    (question) => question.dimension === dimension && isAvailableInMode(question.id, mode),
  ).map((question) => question.id);
}

/** 某个维度是否已经能给出结论（它名下所有可用核心题都答过了）。 */
function isDimensionResolved(
  dimension: AssessmentDimension,
  mode: AssessmentMode,
  answeredIds: Set<string>,
): boolean {
  const coreIds = coreQuestionIdsOf(dimension, mode);
  return coreIds.length > 0 && coreIds.every((id) => answeredIds.has(id));
}

function deservesDeepen(scoring: AssessmentScoring, dimension: AssessmentDimension): boolean {
  const entry = scoring.dimensions.find((candidate) => candidate.dimension === dimension);
  if (!entry || entry.answeredCount === 0 || entry.score === null) return false;
  return entry.score >= DEEPEN_THRESHOLD;
}

export function buildProgress(
  scoring: AssessmentScoring,
  mode: AssessmentMode,
  answeredIds: Set<string>,
): AssessmentStepProgress {
  const dimensions = DIMENSION_ORDER.filter((dimension) => coreQuestionIdsOf(dimension, mode).length > 0);

  return {
    resolvedDimensions: dimensions.filter((dimension) => isDimensionResolved(dimension, mode, answeredIds)).length,
    totalDimensions: dimensions.length,
    answeredCount: answeredIds.size,
  };
}

/**
 * 排出下一题的候选清单。
 *
 * 顺序即优先级：深入题排在核心题前面 —— 刚答完的那道题顺手深挖，比隔几道再绕回来自然。
 */
export function rankCandidates(input: PlanInput): RankingResult {
  const questionnaire = getQuestionnaire(input.mode);
  const askedIds = new Set(input.askedQuestionIds);
  const answeredIds = new Set(
    input.answers.filter((answer) => isAnswered(answer)).map((answer) => answer.questionId),
  );

  // 题目推进以"答过"为准：问过但没答的题允许被重新问（比如用户中途刷新）。
  const isOpen = (question: AssessmentQuestion) =>
    isAvailableInMode(question.id, input.mode) && !askedIds.has(question.id) && !answeredIds.has(question.id);

  const scoring = scoreFromAnswers(questionnaire, input.answers);
  const progress = buildProgress(scoring, input.mode, answeredIds);

  const deepenAlreadyAsked = input.askedQuestionIds.filter((id) => QUESTION_LEVEL[id] === "deepen").length;
  const deepenCandidates: QuestionCandidate[] =
    deepenAlreadyAsked >= DEEPEN_BUDGET[input.mode]
      ? []
      : DEEPEN_QUESTIONS.filter(isOpen)
          .filter((question) => deservesDeepen(scoring, question.dimension))
          .map((question) => ({
            question,
            kind: "deepen" as const,
            reason: `「${labelOf(question.dimension)}」上一题答得比较稳，再问一道更具体的，把「有一点基础」和「已经能做」分开。`,
          }));

  const coreCandidates: QuestionCandidate[] = CORE_QUESTIONS.filter(isOpen)
    .sort((a, b) => dimensionRank(a.dimension) - dimensionRank(b.dimension) || a.order - b.order)
    .map((question) => ({
      question,
      kind: "core" as const,
      reason: `「${labelOf(question.dimension)}」还没有结论，先问这一道。`,
    }));

  const candidates = [...deepenCandidates, ...coreCandidates];

  return {
    candidates,
    doneReason:
      candidates.length === 0
        ? "每个方面的核心问题都已经有了结论，可以生成画像了。"
        : "",
    progress,
  };
}

/**
 * 规则版的下一题。
 *
 * 这是没有 AI、或 AI 调用失败时的路径，所以它**必须永远能给出一个合理答案**，
 * 不能抛异常、不能返回空。
 */
export function planNextQuestion(input: PlanInput): AssessmentStep {
  const ranking = rankCandidates(input);
  const first = ranking.candidates[0];

  if (!first) {
    return {
      done: true,
      question: null,
      probe: null,
      reason: ranking.doneReason,
      decidedBy: "rule",
      progress: ranking.progress,
    };
  }

  return {
    done: false,
    question: first.question,
    probe: null,
    reason: first.reason,
    decidedBy: "rule",
    progress: ranking.progress,
  };
}

/** 供 AI 服务与界面复用的答案摘要：把某个维度已经答过的选项文案读出来。 */
export function summarizeAnswers(
  mode: AssessmentMode,
  answers: AssessmentAnswer[],
): Array<{ dimension: AssessmentDimension; label: string; answered: string }> {
  const questionnaire = getQuestionnaire(mode);
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));

  return questionnaire.questions
    .map((question) => {
      const answer = byId.get(question.id);
      if (!isAnswered(answer)) return null;

      const picked = (answer?.optionIds ?? [])
        .map((optionId) => question.options.find((option) => option.id === optionId)?.label)
        .filter((text): text is string => Boolean(text));

      return {
        dimension: question.dimension,
        label: labelOf(question.dimension),
        answered: answer?.unknown ? "明确表示不了解" : picked.join("、"),
      };
    })
    .filter((entry): entry is { dimension: AssessmentDimension; label: string; answered: string } => entry !== null);
}
