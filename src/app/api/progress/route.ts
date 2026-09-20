import type { ProgressUpdateRequest, TaskProgressStatus } from "@/contracts";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";
import { readProgress, updateProgress } from "@/server/services/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: readonly TaskProgressStatus[] = [
  "not-started",
  "in-progress",
  "completed",
  "skipped",
];

/** 备注长度上限。超长文本不进库，也不进日志。 */
const MAX_NOTE_LENGTH = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 校验请求体。返回 `null` 表示不合法。
 *
 * ⚠️ 这里**不读取 `userId`** —— 身份只从会话取。
 * 请求体里带了 `userId` 会被上层单独判为越权。
 */
function parseUpdateRequest(body: unknown): ProgressUpdateRequest | null {
  if (!isRecord(body)) return null;

  const { roadmapId, taskId, status, note } = body;
  if (typeof roadmapId !== "string" || roadmapId.length === 0) return null;
  if (typeof taskId !== "string" || taskId.length === 0) return null;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as TaskProgressStatus)) {
    return null;
  }
  if (note !== undefined && note !== null && typeof note !== "string") return null;
  if (typeof note === "string" && note.length > MAX_NOTE_LENGTH) return null;

  return {
    roadmapId,
    taskId,
    status: status as TaskProgressStatus,
    note: typeof note === "string" ? note : null,
  };
}

export async function GET(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话已失效，请重新开始。");
    }

    const roadmapId = new URL(request.url).searchParams.get("roadmapId") ?? "";
    return jsonOk(await readProgress(resolved.session.userId, roadmapId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话已失效，请重新开始。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }

    // 身份只认服务端会话：请求体里出现别人的用户标识，直接拒绝而不是静默忽略，
    // 这样越权尝试在日志与测试里都是可见的。
    if (isRecord(body) && typeof body.userId === "string" && body.userId !== resolved.session.userId) {
      return jsonError("FORBIDDEN", "不能修改他人的记录。");
    }

    const parsed = parseUpdateRequest(body);
    if (!parsed) {
      return jsonError("BAD_REQUEST", "任务进度格式不正确。");
    }

    return jsonOk(await updateProgress(resolved.session.userId, parsed));
  } catch (error) {
    return toErrorResponse(error);
  }
}
