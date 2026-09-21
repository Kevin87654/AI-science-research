/**
 * 科研画像契约 —— 对应 PRD §9。
 *
 * ✅ **状态：已由 B（waixr016）确认（2026-09-20），字段未作改动。**
 * 依据来自 PRD §9.2（阶段名称、状态总结、2～5 项优势、2～5 项待补能力、
 * 兴趣方向标签、3 个优先行动、生成依据说明）与 §9.3 的表达原则。
 *
 * 两条产品红线已经体现在字段设计里：
 * - 字段名用 `gaps`（待补能力）而**不用**任何负面标签；
 * - `basis` 必填 —— 画像必须能解释「依据什么得出的」。
 *
 * `userId` 由服务端从会话写入；客户端提交的任何 `userId` 都不被采信。
 */
import type { IsoDateTime, VersionedPayload } from "./common";

/** PRD §9.2 举例的阶段名称：科研观察期 / 入门准备期 / 初步实践期。 */
export type ResearchStageCode =
  | "research-observation"
  | "entry-preparation"
  | "early-practice";

export interface ResearchStage {
  code: ResearchStageCode;
  /** 面向用户的展示名，例如「科研观察期」。 */
  label: string;
}

/**
 * 兴趣方向标签。**这是 B → C 的联动入口**：
 * C 的 `SearchOptions.interests` 直接消费这个数组的 `label`。
 */
export interface InterestTag {
  id: string;
  label: string;
  /** `user-input` = 用户自选；`derived` = 由测评答案推导。 */
  source: "user-input" | "derived";
}

/** 建议优先完成的行动。 */
export interface ProfileAction {
  id: string;
  title: string;
  /** 为什么给这条建议，必须具体可解释。 */
  rationale: string;
  /** 已生成路线时，指向对应的任务 id。 */
  linkedTaskId?: string | null;
}

export interface Profile extends VersionedPayload {
  id: string;
  /** 服务端写入，不可由客户端提交。 */
  userId: string;
  stage: ResearchStage;
  /** 一段个人状态总结。 */
  summary: string;
  /** 2～5 项优势。 */
  strengths: string[];
  /** 2～5 项待补能力（对应 PRD 的「待补能力」，不是缺陷判断）。 */
  gaps: string[];
  interests: InterestTag[];
  /** 建议优先完成的 3 个行动。 */
  priorityActions: ProfileAction[];
  /** 画像生成依据说明，对应 PRD §9.2 最后一项。 */
  basis: string;
  /** 可追溯到具体的测评提交。 */
  sourceSubmissionId: string;
  generatedAt: IsoDateTime;
  isDemo: boolean;
}
