/**
 * 联系消息纯规则测试。
 *
 * 这三处出错的表现分别是：发出空消息、消息顺序乱、非法角色混进会话。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ChatMessage } from "@/contracts";

import {
  isChatMessageKind,
  isChatSenderRole,
  sortMessages,
  validateMessageText,
} from "./message-rules.ts";

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    studentId: "20220001",
    mentorId: "T1001",
    senderRole: "student",
    text: "老师好",
    createdAt: "2026-11-12T01:00:00.000Z",
    kind: "text",
    ...overrides,
  };
}

test("validateMessageText 去空白、拒绝空消息与超长消息", () => {
  assert.deepEqual(validateMessageText("  老师好  "), { ok: true, value: "老师好" });
  assert.equal(validateMessageText("   ").ok, false);
  assert.equal(validateMessageText("字".repeat(2001)).ok, false);
});

test("sortMessages 按时间升序，同一毫秒按 id 稳定排序", () => {
  const sorted = sortMessages([
    message({ id: "b", createdAt: "2026-11-12T02:00:00.000Z" }),
    message({ id: "c", createdAt: "2026-11-12T01:00:00.000Z" }),
    message({ id: "a", createdAt: "2026-11-12T01:00:00.000Z" }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "c", "b"]);
});

test("角色与消息类型只接受约定值", () => {
  assert.equal(isChatSenderRole("student"), true);
  assert.equal(isChatSenderRole("mentor"), true);
  assert.equal(isChatSenderRole("admin"), false);
  assert.equal(isChatMessageKind("text"), true);
  assert.equal(isChatMessageKind("summary"), true);
  assert.equal(isChatMessageKind("file"), false);
});
