/**
 * 联系消息的纯规则（无存储、无网络）。
 *
 * 客户端输入框与服务端写入共用同一套校验：长度、角色、消息类型。
 * 这样"界面上能发出去"和"服务端愿意收"不会出现两套标准。
 */
import type { ChatMessage, ChatMessageKind, ChatSenderRole } from "@/contracts";

/** 单条消息上限。成果汇报比普通聊天长，留到 2000 字。 */
export const MESSAGE_TEXT_MAX = 2000;

export function isChatSenderRole(value: unknown): value is ChatSenderRole {
  return value === "student" || value === "mentor";
}

export function isChatMessageKind(value: unknown): value is ChatMessageKind {
  return value === "text" || value === "summary";
}

export type MessageTextResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateMessageText(text: string): MessageTextResult {
  const value = text.trim();
  if (value.length === 0) return { ok: false, message: "消息不能为空。" };
  if (value.length > MESSAGE_TEXT_MAX) {
    return { ok: false, message: `消息最多 ${MESSAGE_TEXT_MAX} 个字。` };
  }
  return { ok: true, value };
}

/** 消息排序：时间升序，同一毫秒按 id 稳定排序。服务端和客户端都可直接用。 */
export function sortMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}
