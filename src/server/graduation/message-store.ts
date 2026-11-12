import "server-only";

import { randomUUID } from "node:crypto";

import type { ChatMessage, ChatMessageKind, ChatSenderRole } from "@/contracts";
import {
  isChatMessageKind,
  isChatSenderRole,
  sortMessages,
  validateMessageText,
} from "@/features/graduation/message-rules";

/**
 * 学生 ↔ 导师消息的**服务端存储**（⚠️ 演示期是进程内内存）。
 *
 * 为什么不在浏览器 localStorage：学生和导师通常用两个浏览器 / 两台设备，
 * localStorage 互相看不见；放在服务端后，同一台服务器上的两个浏览器轮询同一段会话，
 * 才真的"发得出去、对方看得到"。
 *
 * 现状与边界：
 * - 挂在 `globalThis` 上，避免 Next dev 热更新把模块状态清掉；
 * - 进程重启即清空，Vercel 多实例之间也不共享。接数据库时把这两个函数换成
 *   `graduation_messages` 表的读写即可，API 与界面不用动；
 * - 账号体系还是前端演示登录，所以 senderRole 由客户端声明、服务端只做形状校验，
 *   不能当成真实身份。接真实登录后必须改成"从会话解析发送方"。
 */
const MAX_MESSAGES_PER_THREAD = 200;

type MessageStore = Map<string, ChatMessage[]>;

const globalStore = globalThis as unknown as { __graduationMessages?: MessageStore };
const store: MessageStore = (globalStore.__graduationMessages ??= new Map());

function threadKey(studentId: string, mentorId: string): string {
  return `${studentId}\u0000${mentorId}`;
}

function normalizeId(value: string): string | null {
  const id = value.trim();
  return id.length > 0 && id.length <= 32 ? id : null;
}

export function listMessages(studentId: string, mentorId: string): ChatMessage[] {
  const student = normalizeId(studentId);
  const mentor = normalizeId(mentorId);
  if (!student || !mentor) return [];
  return sortMessages(store.get(threadKey(student, mentor)) ?? []);
}

export type AppendMessageInput = {
  studentId: string;
  mentorId: string;
  senderRole: ChatSenderRole;
  text: string;
  kind?: ChatMessageKind;
};

export type AppendMessageOutcome =
  | { ok: true; message: ChatMessage }
  | { ok: false; message: string };

export function appendMessage(input: AppendMessageInput): AppendMessageOutcome {
  const studentId = normalizeId(input.studentId);
  const mentorId = normalizeId(input.mentorId);
  if (!studentId || !mentorId) {
    return { ok: false, message: "会话双方不完整。" };
  }
  if (!isChatSenderRole(input.senderRole)) {
    return { ok: false, message: "发送方不合法。" };
  }
  if (input.kind !== undefined && !isChatMessageKind(input.kind)) {
    return { ok: false, message: "消息类型不合法。" };
  }

  const validated = validateMessageText(input.text);
  if (!validated.ok) return { ok: false, message: validated.message };

  const message: ChatMessage = {
    id: randomUUID(),
    studentId,
    mentorId,
    senderRole: input.senderRole,
    text: validated.value,
    createdAt: new Date().toISOString(),
    kind: input.kind ?? "text",
  };

  const key = threadKey(studentId, mentorId);
  const thread = store.get(key) ?? [];
  store.set(key, [...thread, message].slice(-MAX_MESSAGES_PER_THREAD));

  return { ok: true, message };
}
