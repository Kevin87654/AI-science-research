/**
 * 任务进度客户端（B 负责）。
 *
 * 进度**只有服务端这一个真相来源**（`/api/progress`，A 负责持久化与用户归属）。
 * 这里刻意不做本地副本：一旦本地也存一份，两边的状态迟早会不一致，
 * 而"进度不一致"对用户来说是比"多等一次请求"严重得多的问题。
 *
 * 因此界面上所有任务状态都必须经过这里，失败就明确报错并允许重试（PRD §19.3）。
 */
import type { ProgressSnapshot, ProgressUpdateRequest } from "@/contracts";
import { postJson, request, type ApiResult } from "@/features/shared/api-client";

export function loadProgress(roadmapId: string): Promise<ApiResult<ProgressSnapshot>> {
  return request<ProgressSnapshot>(`/api/progress?roadmapId=${encodeURIComponent(roadmapId)}`);
}

export function saveTaskProgress(input: ProgressUpdateRequest): Promise<ApiResult<ProgressSnapshot>> {
  return postJson<ProgressSnapshot>("/api/progress", input);
}

/** 把进度快照转成 `taskId → status` 的查表结构，界面不用每次 find。 */
export function toStatusMap(snapshot: ProgressSnapshot | null): Map<string, ProgressSnapshot["items"][number]> {
  const map = new Map<string, ProgressSnapshot["items"][number]>();
  if (!snapshot) return map;
  for (const item of snapshot.items) map.set(item.taskId, item);
  return map;
}
