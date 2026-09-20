/**
 * 任务进度契约 —— 对应 PRD §10.5「标记完成 / 跳过任务」与 §11 成长首页。
 *
 * 这一份属于 A（数据与身份），是本轮**唯一要求落地到数据库**的用户数据。
 * 因为使用的是管理员级 API Key，**RLS 不生效**（见《数据库接入探针记录》§6），
 * 所以每次读写都必须在 Repository 层带上服务端确认的 `userId`，
 * 并且在测试里覆盖「伪造他人标识读不到、也写不进」。
 */
import type { IsoDateTime, VersionedPayload } from "./common";

export type TaskProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "skipped";

export interface TaskProgress {
  taskId: string;
  status: TaskProgressStatus;
  /** 用户个人备注，可为空。 */
  note: string | null;
  updatedAt: IsoDateTime;
}

export interface ProgressSnapshot extends VersionedPayload {
  /** 服务端写入，不可由客户端提交。 */
  userId: string;
  roadmapId: string;
  items: TaskProgress[];
  updatedAt: IsoDateTime;
}

/**
 * 更新请求体。**不含 userId** —— 身份只从会话取，
 * 否则任何人都能凭请求体里的 id 写别人的记录。
 * 带上 `roadmapId` 是为了让每次读写都落在一条明确的路线里。
 */
export interface ProgressUpdateRequest {
  roadmapId: string;
  taskId: string;
  status: TaskProgressStatus;
  note?: string | null;
}
