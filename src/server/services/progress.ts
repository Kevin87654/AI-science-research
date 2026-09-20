import "server-only";

import type { ProgressSnapshot, ProgressUpdateRequest } from "@/contracts";
import { progressRepository } from "@/server/repositories";
import type { ProgressRepository } from "@/server/repositories/types";
import { RepositoryError } from "@/server/repositories/errors";

/**
 * 任务进度。
 *
 * `userId` 必须来自 `identity.ts` 的会话解析结果 —— 这个模块只是把它透传给仓储层，
 * 自身没有任何"没有归属也能读"的路径。
 *
 * 最后一参数可注入，是为了将来换成真实数据库实现时不用改调用方（也便于测试）。
 */
const SCHEMA_VERSION = "1.0.0";

function nowIso(): string {
  return new Date().toISOString();
}

export async function readProgress(
  userId: string,
  roadmapId: string,
  repository: ProgressRepository = progressRepository,
): Promise<ProgressSnapshot> {
  requireRoadmapId(roadmapId);
  const items = await repository.listByUser(userId, roadmapId);
  return {
    schemaVersion: SCHEMA_VERSION,
    userId,
    roadmapId,
    items: items.map((row) => ({
      taskId: row.taskId,
      status: row.status,
      note: row.note,
      updatedAt: row.updatedAt,
    })),
    updatedAt: nowIso(),
  };
}

export async function updateProgress(
  userId: string,
  request: ProgressUpdateRequest,
  repository: ProgressRepository = progressRepository,
): Promise<ProgressSnapshot> {
  requireRoadmapId(request.roadmapId);

  await repository.upsert(userId, {
    roadmapId: request.roadmapId,
    taskId: request.taskId,
    status: request.status,
    note: request.note ?? null,
    now: nowIso(),
  });

  return readProgress(userId, request.roadmapId, repository);
}

function requireRoadmapId(roadmapId: unknown): asserts roadmapId is string {
  if (typeof roadmapId !== "string" || roadmapId.length === 0) {
    throw new RepositoryError("BAD_REQUEST", "缺少学习路线标识");
  }
}
