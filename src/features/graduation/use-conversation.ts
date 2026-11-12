"use client";

/**
 * 会话状态：首屏拉一次，之后每 2 秒轮询（页面不可见时暂停）。
 *
 * 为什么用轮询而不是 WebSocket：现阶段消息存在服务端内存、账号还是演示登录，
 * 轮询 2 秒足够做到"发出去对方马上看到"，且不引入额外的长连接与部署要求。
 * 接真实消息表后再换 SSE / WebSocket，`ContactPanel` 的接口不用改。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/contracts";
import { ensureSession } from "@/features/shared/api-client";

import {
  fetchConversation,
  sendConversationMessage,
  type SendConversationInput,
} from "./conversation-client";
import { sortMessages } from "./message-rules";

const POLL_MS = 2000;

export function useConversation(studentId: string, mentorId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const result = await fetchConversation(studentId, mentorId);
    // 只接受"最后一次发起"的响应：切换学生时旧请求晚到不能覆盖新会话。
    if (!mountedRef.current || requestId !== requestIdRef.current) return;

    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }
    setMessages(result.data);
    setError(null);
    setLoading(false);
  }, [studentId, mentorId]);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      const session = await ensureSession();
      if (!mountedRef.current) return;
      if (!session.ok) {
        setError("连接不上服务器，请稍后刷新页面。");
        setLoading(false);
        return;
      }

      await refresh();
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, POLL_MS);
    })();

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [refresh]);

  const send = useCallback(
    async (input: Omit<SendConversationInput, "studentId" | "mentorId">) => {
      const result = await sendConversationMessage({ ...input, studentId, mentorId });
      if (!result.ok) {
        return { ok: false as const, message: result.message };
      }

      setMessages((previous) => {
        if (previous.some((message) => message.id === result.data.id)) return previous;
        return sortMessages([...previous, result.data]);
      });
      setError(null);
      return { ok: true as const, message: result.data };
    },
    [studentId, mentorId],
  );

  return { messages, loading, error, send, refresh };
}
