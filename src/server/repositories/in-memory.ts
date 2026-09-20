/**
 * 内存实现 —— 用于本地开发、演示与单元测试。
 *
 * ⚠️ **这不是持久化。** 进程重启即丢，Serverless 上每个实例各有一份。
 * 它的作用是让第一条流程在**没有数据库**的情况下先跑通、并被测试覆盖；
 * Step ③ 会把 `src/server/repositories/index.ts` 里的实例换成 PostgREST 实现，接口不变。
 *
 * 两个实现细节值得留意：
 * - **返回的都是副本**，调用方改动返回值不会污染存储（C 模块复测里踩过这个坑）；
 * - **归属过滤写死在实现里**，不给"查全表再过滤"的机会。
 *
 * 本文件可能被 Node 自带测试直接加载，所以运行时相对导入带 `.ts` 扩展名。
 */
import { RepositoryError } from "./errors.ts";
import type {
  CreateSessionInput,
  ProgressRecord,
  ProgressRepository,
  SessionRecord,
  SessionRepository,
  UpsertProgressInput,
} from "./types.ts";

export class InMemorySessionRepository implements SessionRepository {
  private readonly byTokenHash = new Map<string, SessionRecord>();

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    if (!input.tokenHash) {
      throw new RepositoryError("BAD_REQUEST", "缺少会话摘要");
    }
    const record: SessionRecord = {
      userId: `anon-${crypto.randomUUID()}`,
      tokenHash: input.tokenHash,
      accountType: input.accountType,
      createdAt: input.now,
      expiresAt: input.expiresAt,
    };
    this.byTokenHash.set(record.tokenHash, record);
    return { ...record };
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const found = this.byTokenHash.get(tokenHash);
    return found ? { ...found } : null;
  }

  async removeByTokenHash(tokenHash: string): Promise<void> {
    this.byTokenHash.delete(tokenHash);
  }
}

export class InMemoryProgressRepository implements ProgressRepository {
  private readonly rows = new Map<string, ProgressRecord>();

  private static key(userId: string, roadmapId: string, taskId: string): string {
    return [userId, roadmapId, taskId].join("\u0000");
  }

  async listByUser(userId: string, roadmapId: string): Promise<ProgressRecord[]> {
    InMemoryProgressRepository.requireOwner(userId);
    const owned: ProgressRecord[] = [];
    for (const row of this.rows.values()) {
      if (row.userId === userId && row.roadmapId === roadmapId) {
        owned.push({ ...row });
      }
    }
    return owned.sort((a, b) => a.taskId.localeCompare(b.taskId));
  }

  async upsert(userId: string, input: UpsertProgressInput): Promise<ProgressRecord> {
    InMemoryProgressRepository.requireOwner(userId);
    if (!input.taskId) {
      throw new RepositoryError("BAD_REQUEST", "缺少任务标识");
    }
    const record: ProgressRecord = {
      userId,
      roadmapId: input.roadmapId,
      taskId: input.taskId,
      status: input.status,
      note: input.note,
      updatedAt: input.now,
    };
    this.rows.set(InMemoryProgressRepository.key(userId, input.roadmapId, input.taskId), record);
    return { ...record };
  }

  /** 没有归属就无法读写 —— 允许空 userId 会让"忘了带过滤"变成默认行为。 */
  private static requireOwner(userId: string): void {
    if (typeof userId !== "string" || userId.length === 0) {
      throw new RepositoryError("BAD_REQUEST", "缺少用户归属，拒绝访问");
    }
  }
}
