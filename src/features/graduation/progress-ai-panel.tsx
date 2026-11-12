"use client";

/**
 * 学生进度页的 AI 助手（2026-11-12 新增）。
 *
 * 两个动作，分别对应两个接口：
 *   1. 对照学院时间轴提醒我 → `/api/graduation/reminder`；
 *   2. 一键汇总并发送给导师 → `/api/graduation/summary`，成功后把正文写进会话。
 *
 * 所有 AI 结果都带 `source`：模型失败时服务端会回落规则版本，页面照常显示，
 * 只把角标从「AI 生成」换成「基础提醒 / 基础汇总」—— 不假装 AI 一定成功。
 */
import { useState } from "react";

import type { GraduationReminder, GraduationSummary, StudentNode } from "@/contracts";
import { ensureSession, postJson } from "@/features/shared/api-client";

import { formalDraftKey } from "./use-workflow";
import { sendConversationMessage } from "./conversation-client";

type Busy = "reminder" | "summary" | null;

export function ProgressAiPanel({
  studentId,
  mentorId,
  mentorName,
  nodes,
  today,
  onOpenContact,
}: {
  studentId: string;
  mentorId: string;
  mentorName: string;
  nodes: readonly StudentNode[];
  today: string;
  onOpenContact: () => void;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminder, setReminder] = useState<GraduationReminder | null>(null);
  const [summary, setSummary] = useState<GraduationSummary | null>(null);
  const [sent, setSent] = useState(false);
  const [delivering, setDelivering] = useState(false);

  async function ensureApiSession(): Promise<boolean> {
    const session = await ensureSession();
    if (!session.ok) {
      setError("连接服务器失败，请稍后重试。");
      return false;
    }
    return true;
  }

  async function handleReminder() {
    setBusy("reminder");
    setError(null);
    if (!(await ensureApiSession())) {
      setBusy(null);
      return;
    }

    const result = await postJson<GraduationReminder>("/api/graduation/reminder", {
      studentId,
      today,
      nodes,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReminder(result.data);
  }

  async function deliver(data: GraduationSummary): Promise<void> {
    setDelivering(true);
    const outcome = await sendConversationMessage({
      studentId,
      mentorId,
      senderRole: "student",
      text: `${data.title}\n\n${data.body}`,
      kind: "summary",
    });
    setDelivering(false);
    if (!outcome.ok) {
      setSent(false);
      setError(outcome.message);
      return;
    }
    setError(null);
    setSent(true);
  }

  async function handleSummary() {
    if (nodes.length === 0) {
      setError("先记录一条进度，再汇总给导师。");
      return;
    }

    setBusy("summary");
    setError(null);
    setSent(false);
    if (!(await ensureApiSession())) {
      setBusy(null);
      return;
    }

    const result = await postJson<GraduationSummary>("/api/graduation/summary", {
      studentId,
      today,
      nodes,
    });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSummary(result.data);
    await deliver(result.data);
  }

  const disabled = busy !== null;

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-title">
      <div className="ai-panel-head">
        <div>
          <p className="eyebrow">AI · 进度助手</p>
          <h3 className="ai-panel-title" id="ai-panel-title">
            对照学院时间轴，看看下一步
          </h3>
          <p className="ai-panel-note">
            基于你记录的节点和学院 2027 届工作安排生成。AI 建议仅供参考，节点日期以学院通知为准。
          </p>
        </div>
        <span className="ai-badge">AI</span>
      </div>

      <div className="ai-actions">
        <button className="button-small" type="button" onClick={handleReminder} disabled={disabled}>
          {busy === "reminder" ? "正在对照…" : "对照时间轴提醒我"}
        </button>
        <button className="button-ghost" type="button" onClick={handleSummary} disabled={disabled || nodes.length === 0}>
          {busy === "summary" ? "正在汇总…" : "一键汇总并发送给导师"}
        </button>
      </div>

      {nodes.length === 0 ? (
        <p className="ai-note">还没有记录节点：先在上方记一条，「汇总成果」才会有内容。</p>
      ) : null}

      {error ? (
        <p className="error-text ai-error" role="alert">
          {error}
        </p>
      ) : null}

      {reminder ? (
        <div className="ai-result" role="status">
          <div className="ai-result-head">
            <span className="ai-source">{reminder.source === "ai" ? "AI 生成" : "基础提醒"}</span>
          </div>
          <p className="ai-headline">{reminder.headline}</p>
          <ul className="ai-list">
            {reminder.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary ? (
        <div className="ai-result" role="status">
          <div className="ai-result-head">
            <span className="ai-source">{summary.source === "ai" ? "AI 生成" : "基础汇总"}</span>
            <span className="ai-result-note">覆盖 {summary.nodeCount} 条节点</span>
          </div>
          <p className="ai-headline">{summary.title}</p>
          <pre className="ai-summary-body">{summary.body}</pre>

          <button className="button-ghost" type="button" onClick={()=>{
            try { sessionStorage.setItem(formalDraftKey(studentId,mentorId),JSON.stringify({title:summary.title,content:summary.body,sources:nodes.map(node=>({id:node.id,date:node.date,title:node.title,note:node.note}))}));setError(null);onOpenContact(); }
            catch {setError("无法保存草稿，请到联系导师中点击正式提交。");}
          }}>转为正式提交（可编辑）</button>

          {sent ? (
            <div className="ai-sent">
              <span>已发送给 {mentorName}，可在「联系导师」查看。</span>
              <button className="button-ghost" type="button" onClick={onOpenContact}>
                去对话
              </button>
            </div>
          ) : (
            <button
              className="button-small"
              type="button"
              onClick={() => void deliver(summary)}
              disabled={delivering}
            >
              {delivering ? "正在发送…" : "重新发送给导师"}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
