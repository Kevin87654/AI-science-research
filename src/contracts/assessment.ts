/**
 * 科研认知测评契约 —— 对应 PRD §8。
 *
 * ⚠️ **本文件是草稿，字段待 B（waixr016）确认。**
 * 依据来自 PRD §8.2 的八个维度与 §8.3 的题型要求（以单选/多选为主、
 * 认知题必须有「不知道/不了解」、支持返回修改、显示进度）。
 * B 确认或调整后去掉本标记。
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
