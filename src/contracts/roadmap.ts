/**
 * 个性化学习路线契约 —— 对应 PRD §10。
 *
 * ⚠️ **本文件是草稿，字段待 B（waixr016）确认。**
 * 依据来自 PRD §10.3 的路线结构（路线名称、总目标、建议周期、阶段说明、
 * 任务列表、每项任务预计耗时、关联资料、完成标准）与 §10.5 的用户操作。
 *
 * 设计取舍：**任务状态不放在这里**。
 * `RoadmapTask` 只描述"计划长什么样"，属于 B；"做到哪一步"属于进度，
 * 存在 `progress.ts`，由 A 负责持久化与用户归属。
 */
import type { IsoDateTime, VersionedPayload } from "./common";

export interface RoadmapStage {
  id: string;
  order: number;
  title: string;
  description: string;
  /** 该阶段包含的任务 id，顺序与展示顺序一致。 */
  taskIds: string[];
}

export interface RoadmapTask {
  id: string;
  stageId: string;
  order: number;
  title: string;
  description: string;
  /** 预计耗时（分钟）。PRD §10.3 要求每项任务都要有。 */
  estimatedMinutes: number;
  /** 完成标准，至少一条，否则任务无法判定完成。 */
  completionCriteria: string[];
  /** 关联资料 id，指向知识/资源侧。 */
  resourceIds: string[];
  /** 是否允许跳过（PRD §10.5 的「跳过任务」）。 */
  skippable: boolean;
}

export interface Roadmap extends VersionedPayload {
  id: string;
  /** 服务端写入，不可由客户端提交。 */
  userId: string;
  /** 依据哪份画像生成，便于追溯与重新规划。 */
  profileId: string;
  title: string;
  goal: string;
  /** 建议周期（周）。 */
  suggestedWeeks: number;
  stages: RoadmapStage[];
  tasks: RoadmapTask[];
  generatedAt: IsoDateTime;
  isDemo: boolean;
}
