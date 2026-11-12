"use client";

/**
 * 学生 ↔ 导师的会话面板（学生端「联系导师」、导师端「联系学生」共用）。
 *
 * 消息走服务端 `/api/graduation/messages`，每 2 秒轮询一次：
 * 学生在一个浏览器发，导师在另一个浏览器看，几秒内就能看到。
 * 演示期消息存在服务端内存，进程重启会清空；接数据库后只换存储层。
 */
import { useEffect, useRef, useState } from "react";

import type { StudentNode, ChatMessage } from "@/contracts";

import { WorkflowPanel } from "./workflow-panel";
import { useConversation } from "./use-conversation";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

function roleLabel(role: "student" | "mentor"): string {
  return role === "student" ? "学生" : "导师";
}

export function ContactPanel({
  role,
  studentId,
  studentName,
  mentorId,
  mentorName,
  nodes,
}: {
  role: "student" | "mentor";
  studentId: string;
  studentName: string;
  mentorId: string;
  mentorName: string;
  nodes?: readonly StudentNode[];
}) {
  const { messages, loading, error: loadError, send } = useConversation(studentId, mentorId);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const otherName = role === "student" ? mentorName : studentName;
  const otherLabel = roleLabel(role === "student" ? "mentor" : "student");
  const otherId = role === "student" ? mentorId : studentId;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  async function handleSend() {
    if (sending || loading) return;
    setSending(true);
    setError(null);
    const outcome = await send({ senderRole: role, text: draft });
    setSending(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setDraft("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSend();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend();
    }
  }

  const visibleError = error ?? loadError;

  return (
    <section className="chat" aria-label={`与${otherName}的会话`}>
      <header className="chat-head">
        <div>
          <h3 className="chat-title">{otherName}</h3>
          <p className="chat-sub">
            {otherLabel} · {otherId}
          </p>
        </div>
        <span className="chat-status">{loadError ? "重连中" : "每 2 秒同步"}</span>
      </header>

      <WorkflowPanel key={`${studentId}:${mentorId}:${role}`} {...{role,studentId,mentorId,nodes}}/>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite">
        {loading ? (
          <p className="chat-loading">正在加载会话…</p>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-title">还没有消息</p>
            <p className="chat-empty-text">
              {role === "student"
                ? "可以先发一条进度汇报，或把卡住的问题直接说给导师。"
                : "学生还没有发来消息。也可以先问一句现在的进度。"}
            </p>
          </div>
        ) : (
          messages.map((message: ChatMessage) => {
            const self = message.senderRole === role;
            return (
              <article className={self ? "chat-msg chat-msg-self" : "chat-msg"} key={message.id}>
                <div className="chat-meta">
                  <span>{self ? "我" : otherName}</span>
                  <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  {message.kind === "summary" ? <span className="chat-kind">成果汇报</span> : null}
                </div>
                <p className="chat-text">{message.text}</p>
              </article>
            );
          })
        )}
      </div>

      <form className="chat-compose" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={`chat-input-${studentId}-${role}`}>
          消息内容
        </label>
        <textarea
          id={`chat-input-${studentId}-${role}`}
          className="chat-input"
          value={draft}
          maxLength={1000}
          rows={3}
          placeholder={role === "student" ? "向导师汇报进度，或问一个具体问题…" : "回复学生，或给一条下一步建议…"}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="chat-compose-row">
          <span className="chat-count">{draft.length}/1000 · Ctrl + Enter 发送</span>
          <button className="button-small" type="submit" disabled={draft.trim().length === 0 || sending || loading}>
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
        {visibleError ? (
          <p className="error-text" role="alert">
            {visibleError}
          </p>
        ) : null}
      </form>
    </section>
  );
}
