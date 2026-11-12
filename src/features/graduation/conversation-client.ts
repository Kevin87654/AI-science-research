/**
 * 会话接口的浏览器侧封装（不含状态）。
 *
 * 单独拆出来是为了让 `useConversation`（轮询）和 `ProgressAiPanel`（一键发送）
 * 共用同一套 URL 与解包逻辑，避免两处各写一遍。
 */
import type { ChatMessage, ChatMessageKind, ChatSenderRole } from "@/contracts";
import { postJson, request, type ApiResult } from "@/features/shared/api-client";

export type SendConversationInput = {
  studentId: string;
  mentorId: string;
  senderRole: ChatSenderRole;
  text: string;
  kind?: ChatMessageKind;
};

export async function fetchConversation(
  studentId: string,
  mentorId: string,
): Promise<ApiResult<ChatMessage[]>> {
  const query = `studentId=${encodeURIComponent(studentId)}&mentorId=${encodeURIComponent(mentorId)}`;
  const result = await request<{ messages: ChatMessage[] }>(`/api/graduation/messages?${query}`);
  return result.ok ? { ok: true, data: result.data.messages } : result;
}

export async function sendConversationMessage(
  input: SendConversationInput,
): Promise<ApiResult<ChatMessage>> {
  const result = await postJson<{ message: ChatMessage }>("/api/graduation/messages", input);
  return result.ok ? { ok: true, data: result.data.message } : result;
}
