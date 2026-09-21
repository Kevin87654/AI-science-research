/**
 * 科研认知测评契约 —— 对应 PRD §8。
 *
 * ✅ **状态：已由 B（waixr016）确认（2026-09-20）。**
 * 八个维度来自 PRD §8.2；题型约束来自 §8.3（以单选/多选为主、
 * 认知题必须有「不知道/不了解」、支持返回修改、显示进度）。
 *
 * 本轮由 B 补了一处字段：`AssessmentOption.score`。
 * 原因是问卷本身就是"契约形状的数据"，评分依据若另存一份映射表，
 * 题库一改动就会出现两份数据漂移；放在选项上则不可能不同步。
 * 它只是可序列化的数字，不违反契约层"只放可序列化数据"的约束。
 *
 * ⚠️ 改字段必须同步改 `samples.ts`（不改就编译不过，这是刻意的）。
 */
import type { IsoDateTime, VersionedPayload } from "./common";

/** PRD §8.2 的八个测评维度。 */
export type AssessmentDimension =
  | "research-literacy"
  | "paper-literacy"
  | "information-retrieval"
  | "method-basics"
  | "skill-basics"
  | "interest-direction"
  | "action-experience"
  | "goal-and-time";

export type AssessmentQuestionType = "single" | "multi";

/** 评测模式：演示用缩短版，**不改变评分逻辑**，只减少题量。 */
export type AssessmentMode = "full" | "demo";

export interface AssessmentOption {
  id: string;
  label: string;
  /**
   * 该选项在所属维度上的得分，0～3。
   *
   * `null` 表示「不知道 / 不了解 / 还没想过」——**不计分**，
   * 单独作为"需要补的认知缺口"的依据，不与"答错"混为一谈。
   *
   * 兴趣方向与时间投入这两个维度同样用它：兴趣题用选项 `id` 作为
   * 兴趣标签 id、`label` 作为标签文案（`InterestTag` 直接由此生成）；
   * 时间题的每周小时数见 `src/features/assessment/question-bank.ts`。
   */
  score: number | null;
}

export interface AssessmentQuestion {
  id: string;
  dimension: AssessmentDimension;
  prompt: string;
  type: AssessmentQuestionType;
  order: number;
  options: AssessmentOption[];
  /** 是否提供「不知道 / 不了解」选项。认知类题目应为 `true`。 */
  allowUnknown: boolean;
  required: boolean;
}

export interface AssessmentQuestionnaire extends VersionedPayload {
  id: string;
  mode: AssessmentMode;
  /** 预计完成时间，PRD §8.5 要求全量 3～5 分钟。 */
  estimatedMinutes: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentAnswer {
  questionId: string;
  /** 单选给 1 个、多选给多个；选「不知道」时可以是空数组。 */
  optionIds: string[];
  /** 用户明确选了「不知道」。用于区分「没答」与「诚实地不知道」。 */
  unknown: boolean;
}

/** 提交请求体。**不含 userId**，身份由服务端从会话确认。 */
export interface AssessmentSubmission {
  questionnaireId: string;
  mode: AssessmentMode;
  answers: AssessmentAnswer[];
  submittedAt: IsoDateTime;
}

/* ------------------------------------------------------------------ *
 * 自适应提问（一次只问一题）
 *
 * 设计取舍：**AI 决定"问什么"，确定性规则决定"算什么"。**
 * 选题可以由模型个性化（依据已答内容挑最有信息量的下一题），但维度得分、阶段判定、
 * 画像生成仍走纯函数 —— PRD 明确要求评分使用可解释的确定性规则；把判定交给模型
 * 会让结果无法复现，也无法解释给学生听。
 *
 * 安全阀：模型返回的题号**必须落在候选列表内**，否则整条结果作废、退回规则选题。
 * ------------------------------------------------------------------ */

/** 谁决定了这一题。界面据此展示来源，也是排查线上问题的抓手。 */
export type AssessmentStepSource = "ai" | "rule";

/** 请求下一题。`askedQuestionIds` 含历史提问，用于避免重复。 */
export interface AssessmentStepRequest {
  mode: AssessmentMode;
  answers: AssessmentAnswer[];
  askedQuestionIds: string[];
}

export interface AssessmentStepProgress {
  /** 已经能给出结论的维度数（"明确不知道"也算结论）。 */
  resolvedDimensions: number;
  totalDimensions: number;
  answeredCount: number;
}

/** 一次自适应提问的结果：要么给出下一题，要么表示可以出画像了。 */
export interface AssessmentStep {
  /** `true` = 已经问完，可以生成画像。 */
  done: boolean;
  /** `done` 为 `false` 时必然非空。 */
  question: AssessmentQuestion | null;
  /**
   * 针对上一题作答的一句个性化回应或追问，**不计分**。
   * 规则模式下为 `null` —— 宁可没有，也不编造"老师般的点评"。
   */
  probe: string | null;
  /** 为什么问这一题。界面上折叠展示，也是"可解释"的一部分。 */
  reason: string;
  decidedBy: AssessmentStepSource;
  progress: AssessmentStepProgress;
}
