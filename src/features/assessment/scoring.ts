/**
 * 测评评分（B 负责）—— **纯函数，不碰网络、不碰 React**。
 *
 * 这样安排是为了让"结果对不对"可以脱离浏览器单独验证：
 * 换一组答案直接调 `scoreAssessment` 就能看到画像依据的变化。
 *
 * 两条刻意的设计：
 *
 * 1. **区分"能力维度"与"偏好维度"**。
 *    兴趣方向和目标时间不计分——把兴趣当能力打分会把阶段评低，
 *    而阶段表达的是"你现在能做多少"，不是"你想做什么"。
 *
 * 2. **「不知道」不等于 0 分**。
 *    用户明确选「不知道」时该维度记为 `unknown`（认知缺口），
 *    与"选了最低档"（`starting`）是两种不同的结论，后续给的行动也不同。
 */
import type {
  AssessmentAnswer,
  AssessmentDimension,
  AssessmentQuestion,
  AssessmentQuestionnaire,
  AssessmentSubmission,
} from "@/contracts";
// 用相对路径 + `.ts` 后缀：这样 `pnpm test`（node --test）能直接加载本模块。
// 纯函数必须能脱离 Next 运行时单独验证，见《工程起步与分工路线》的验收门槛。
import { WEEKLY_HOURS_BY_OPTION } from "./question-bank.ts";

/** 维度性质：能力维度参与阶段判定，偏好维度只影响路线与推荐。 */
export type DimensionKind = "ability" | "preference";

export const DIMENSION_KIND: Record<AssessmentDimension, DimensionKind> = {
  "research-literacy": "ability",
  "paper-literacy": "ability",
  "information-retrieval": "ability",
  "method-basics": "ability",
  "skill-basics": "ability",
  "action-experience": "ability",
  "interest-direction": "preference",
  "goal-and-time": "preference",
};

export type DimensionLevel = "unknown" | "starting" | "developing" | "ready";

/** 等级阈值（选项分值区间 0～3）。整数分界，便于解释给用户听。 */
export const LEVEL_THRESHOLDS = { ready: 2.5, developing: 1.5 } as const;

export type DimensionScore = {
  dimension: AssessmentDimension;
  kind: DimensionKind;
  /** 该维度平均分（0～3）；无可计分作答时为 `null`。 */
  score: number | null;
  level: DimensionLevel;
  /** 该维度下已作答的题数 / 总题数。 */
  answeredCount: number;
  totalCount: number;
  /** 该维度下用户至少明确选过一次「不知道」。 */
  unknownDeclared: boolean;
};

export type InterestLabel = { id: string; label: string };

/** 偏好维度读出来的规划参数。 */
export type PreferenceValues = {
  interests: InterestLabel[];
  weeklyHours: number | null;
  goalOptionId: string | null;
};

export type AssessmentScoring = {
  dimensions: DimensionScore[];
  /** 参与阶段判定的能力维度。 */
  abilityDimensions: DimensionScore[];
  /** 由兴趣题选项直接得到的标签，供 C 模块检索使用。 */
  interests: InterestLabel[];
  /** 每周可投入小时数；未作答为 `null`。 */
  weeklyHours: number | null;
  /** 目标题选中的选项 id；未作答为 `null`。 */
  goalOptionId: string | null;
  /** 等级为 `unknown` 的能力维度——后续据此生成"待补能力"。 */
  unknownDimensions: AssessmentDimension[];
  answeredCount: number;
  totalCount: number;
};

function toAnswerMap(answers: AssessmentAnswer[]): Map<string, AssessmentAnswer> {
  const map = new Map<string, AssessmentAnswer>();
  for (const answer of answers) {
    map.set(answer.questionId, answer);
  }
  return map;
}

/** 该作答是否算"答过了"：选了选项，或明确选了「不知道」。 */
function isAnswered(answer: AssessmentAnswer | undefined): answer is AssessmentAnswer {
  if (!answer) return false;
  return answer.optionIds.length > 0 || answer.unknown;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 单题的得分：多个选项取平均；全部选项都不计分时为 `null`。 */
function scoreOfQuestion(question: AssessmentQuestion, answer: AssessmentAnswer | undefined): number | null {
  if (!answer || answer.unknown || answer.optionIds.length === 0) return null;

  const scores: number[] = [];
  for (const optionId of answer.optionIds) {
    const option = question.options.find((candidate) => candidate.id === optionId);
    if (option && option.score !== null) scores.push(option.score);
  }
  return average(scores);
}

export function levelOf(score: number | null): DimensionLevel {
  if (score === null) return "unknown";
  if (score >= LEVEL_THRESHOLDS.ready) return "ready";
  if (score >= LEVEL_THRESHOLDS.developing) return "developing";
  return "starting";
}

/**
 * 校验必答题。
 * 返回未完成的题目 id 列表——**不抛异常**，让界面决定怎么提示。
 */
export function findUnansweredQuestions(
  questionnaire: AssessmentQuestionnaire,
  answers: AssessmentAnswer[],
): string[] {
  const map = toAnswerMap(answers);
  return questionnaire.questions
    .filter((question) => question.required && !isAnswered(map.get(question.id)))
    .map((question) => question.id);
}

export function buildSubmission(
  questionnaire: AssessmentQuestionnaire,
  answers: AssessmentAnswer[],
  submittedAt: string,
): AssessmentSubmission {
  return {
    questionnaireId: questionnaire.id,
    mode: questionnaire.mode,
    answers,
    submittedAt,
  };
}

/** 把偏好维度（兴趣 / 目标 / 时间）的选中项翻译成规划参数，不参与评分。 */
export function readPreferenceValues(
  questionnaire: AssessmentQuestionnaire,
  answers: AssessmentAnswer[],
): PreferenceValues {
  const map = toAnswerMap(answers);
  const values: PreferenceValues = { interests: [], weeklyHours: null, goalOptionId: null };

  for (const question of questionnaire.questions) {
    if (DIMENSION_KIND[question.dimension] !== "preference") continue;

    const answer = map.get(question.id);
    if (!answer || answer.unknown) continue;

    for (const optionId of answer.optionIds) {
      const option = question.options.find((candidate) => candidate.id === optionId);
      if (!option) continue;

      if (question.dimension === "interest-direction") {
        values.interests.push({ id: option.id, label: option.label });
      }

      const hours = WEEKLY_HOURS_BY_OPTION[option.id];
      if (typeof hours === "number") values.weeklyHours = hours;

      if (question.id === "q-goal") values.goalOptionId = option.id;
    }
  }

  return values;
}

export function scoreAssessment(
  questionnaire: AssessmentQuestionnaire,
  submission: AssessmentSubmission,
): AssessmentScoring {
  return scoreFromAnswers(questionnaire, submission.answers);
}

/**
 * 只依据作答内容算分，不关心提交元信息。
 *
 * 自适应提问要在"还没提交"的时候就知道每一档当前的水平（才能决定要不要深挖一道），
 * 所以把这段单独暴露出来，省得调用方为了调它先伪造一个 `submittedAt`。
 *
 * ⚠️ `unknownDimensions` 只统计**答过但明确说不知道**的维度。
 * 没问到的维度不能算缺口 —— 自适应流程可能少问几道，把"没问过"说成"你不会"是冤枉人。
 */
export function scoreFromAnswers(
  questionnaire: AssessmentQuestionnaire,
  answers: AssessmentAnswer[],
): AssessmentScoring {
  const map = toAnswerMap(answers);
  const dimensions: DimensionScore[] = [];
  let answeredCount = 0;

  const dimensionIds = Array.from(new Set(questionnaire.questions.map((question) => question.dimension)));

  for (const dimension of dimensionIds) {
    const questions = questionnaire.questions.filter((question) => question.dimension === dimension);
    const kind = DIMENSION_KIND[dimension];

    let answered = 0;
    let unknownDeclared = false;
    const questionScores: number[] = [];

    for (const question of questions) {
      const answer = map.get(question.id);
      if (isAnswered(answer)) answered += 1;
      if (answer?.unknown) unknownDeclared = true;

      if (kind === "ability") {
        const value = scoreOfQuestion(question, answer);
        if (value !== null) questionScores.push(value);
      }
    }

    answeredCount += answered;

    const score = kind === "ability" ? average(questionScores) : null;

    dimensions.push({
      dimension,
      kind,
      score,
      level: levelOf(score),
      answeredCount: answered,
      totalCount: questions.length,
      unknownDeclared,
    });
  }

  const preference = readPreferenceValues(questionnaire, answers);
  const abilityDimensions = dimensions.filter((entry) => entry.kind === "ability");

  return {
    dimensions,
    abilityDimensions,
    interests: preference.interests,
    weeklyHours: preference.weeklyHours,
    goalOptionId: preference.goalOptionId,
    unknownDimensions: abilityDimensions
      .filter((entry) => entry.level === "unknown" && entry.answeredCount > 0)
      .map((entry) => entry.dimension),
    answeredCount,
    totalCount: questionnaire.questions.length,
  };
}
