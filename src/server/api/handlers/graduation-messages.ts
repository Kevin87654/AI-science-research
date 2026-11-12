import type { ChatMessage } from "@/contracts";
import { isChatMessageKind, isChatSenderRole } from "@/features/graduation/message-rules";
import { appendMessage, listMessages } from "@/server/graduation/message-store";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";

/**
 * 学生 ↔ 导师消息接口。
 *
 * GET  `/api/graduation/messages?studentId=…&mentorId=…`  拉取一段会话
 * POST `/api/graduation/messages`                        发送一条
 *
 * 必须带匿名会话（同 AI 接口），挡住公开站点上的无成本刷写。
 * ⚠️ 账号还是演示登录，`senderRole` 由客户端声明；接真实登录后必须改成从会话解析。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 && id.length <= 32 ? id : null;
}

export async function handleGraduationMessagesGet(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再试。");
    }

    const url = new URL(request.url);
    const studentId = readId(url.searchParams.get("studentId"));
    const mentorId = readId(url.searchParams.get("mentorId"));
    if (!studentId || !mentorId) {
      return jsonError("BAD_REQUEST", "缺少会话双方。");
    }

    return jsonOk<{ messages: ChatMessage[] }>({
      messages: listMessages(studentId, mentorId),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function handleGraduationMessagesPost(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再试。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }
    if (!isRecord(body)) {
      return jsonError("BAD_REQUEST", "请求体格式不正确。");
    }

    const studentId = readId(body.studentId);
    const mentorId = readId(body.mentorId);
    if (!studentId || !mentorId) {
      return jsonError("BAD_REQUEST", "会话双方不完整。");
    }
    if (!isChatSenderRole(body.senderRole)) {
      return jsonError("BAD_REQUEST", "发送方不合法。");
    }

    const kind = body.kind === undefined ? "text" : body.kind;
    if (!isChatMessageKind(kind) || typeof body.text !== "string") {
      return jsonError("BAD_REQUEST", "消息内容不合法。");
    }

    const outcome = appendMessage({
      studentId,
      mentorId,
      senderRole: body.senderRole,
      text: body.text,
      kind,
    });
    if (!outcome.ok) {
      return jsonError("BAD_REQUEST", outcome.message);
    }

    return jsonOk<{ message: ChatMessage }>({ message: outcome.message });
  } catch (error) {
    return toErrorResponse(error);
  }
}
