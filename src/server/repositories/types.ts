/**
 * 数据访问接口（A 负责）。
 *
 * 设计上有两条刻意的约束：
 *
 * 1. **不允许写不带时间戳的接口** —— 所有方法显式接收 `now`，
 *    这样行为可预测、测试不需要真的等时间。
 * 2. **每个用户数据方法都把 `userId` 作为必需的第一个参数。**
 *    这不是风格问题：我们的 API Key 带 `bypassrls`，**数据库的行级权限对我们完全无效**，
 *    只有应用层的归属过滤能挡住越权。接口层面就不给"不带归属的查询"留入口。
 *
 * 本文件只含类型，运行时不会加载它。
 */
import type { AccountType, IsoDateTime, TaskProgressStatus } from "@/contracts";

export interface SessionRecord {
  userId: string;
  /** 令牌的 SHA-256 摘要。**明文令牌不落库。** */
  tokenHash: string;
  accountType: AccountType;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
}

export interface CreateSessionInput {
  tokenHash: string;
  accountType: AccountType;
  expiresAt: IsoDateTime | null;
  now: IsoDateTime;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  removeByTokenHash(tokenHash: string): Promise<void>;
}

export interface ProgressRecord {
  userId: string;
  roadmapId: string;
  taskId: string;
  status: TaskProgressStatus;
  note: string | null;
  updatedAt: IsoDateTime;
}

export interface UpsertProgressInput {
  roadmapId: string;
  taskId: string;
  status: TaskProgressStatus;
  note: string | null;
  now: IsoDateTime;
}

export interface ProgressRepository {
  /** 只返回属于 `userId` 的记录；实现必须自己带归属过滤，调用方不会再过滤一次。 */
  listByUser(userId: string, roadmapId: string): Promise<ProgressRecord[]>;
  upsert(userId: string, input: UpsertProgressInput): Promise<ProgressRecord>;
}
