"use client";

/**
 * 大四学生工作台：毕设进度追踪（两条时间轴）。
 *
 * 为什么是两条而不是一条：
 *   · 上面那条是**学院下达的**统一节点（人人相同，不能改）；
 *   · 下面那条是**学生自己记的**进度（什么时候做了什么）。
 * 合成一条会出现"分不清哪条是学校要求的、哪条是我自己写的"，而这恰恰是学生最需要分清的事。
 *
 * 数据现状：学校节点是常量；自建节点存在本机（`student-nodes.ts`），
 * 登录与落库都在下一轮，页面上有明确说明，不假装已经存到了服务器。
 */
import { useEffect, useState } from "react";

import type { StudentNode } from "@/contracts";
import { findAccountById } from "@/features/auth/demo-accounts";
import { useRoleSession } from "@/features/auth/use-role-session";
import { useIsClient } from "@/features/shared/use-local-flow";
import { NODE_NOTE_MAX, NODE_TITLE_MAX, validateNodeDraft } from "./node-rules";
import { RoleGate } from "./role-gate";
import { SCHOOL_MILESTONES } from "./school-milestones";
import { StudentDock, type StudentView } from "./student-dock";
import { addNode, nodesFor, removeNode } from "./student-nodes";
import { ContactPanel } from "./contact-panel";
import { mentorIdForStudent } from "./contact";
import { ProgressAiPanel } from "./progress-ai-panel";
import { SchoolTimeline } from "./timeline";
import { formatIsoDate, latestByDate, pickNextMilestone, toLocalIsoDate } from "./timeline-meta";
import { useMentorGroupsState } from "./use-mentor-groups";
import { useStudentNodesState } from "./use-student-nodes";
import { WorkspaceBar } from "./workspace-bar";

import { ProgressWithMeetings } from "./workflow-panel";

type FormMessage = { kind: "error" | "ok"; text: string } | null;

export function StudentWorkspace() {
  const isClient = useIsClient();
  const session = useRoleSession();
  const state = useStudentNodesState();
  const groupsState = useMentorGroupsState();

  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<FormMessage>(null);
  /** 默认落在学院节点上：第一次进来先看学校要求，再看自己记了什么。 */
  const [view, setView] = useState<StudentView>("school");

  // 切换侧栏视图后回到顶部：否则从很长的进度页切到「联系导师」，
  // 会直接落在会话中间，连标题都看不到。
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  if (!isClient) return <div className="workspace-loading" aria-busy="true" />;
  if (!session || session.role !== "student") return <RoleGate role="student" />;

  const account = findAccountById(session.accountId);
  // 先取出来：`session` 是可能为 null 的联合类型，在事件回调里 TS 不会保留上面的类型收窄。
  const accountId = session.accountId;
  const today = toLocalIsoDate(new Date());
  const nodes: StudentNode[] = nodesFor(state, accountId);
  const next = pickNextMilestone(SCHOOL_MILESTONES, today);
  const latest = latestByDate(nodes);
  const mentorId = mentorIdForStudent(groupsState, accountId);
  const mentor = findAccountById(mentorId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateNodeDraft({ date: date || today, title, note });
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }

    const written = addNode(accountId, result.value);
    if (!written.ok) {
      setMessage({ kind: "error", text: written.message });
      return;
    }

    setMessage({ kind: "ok", text: `已添加：${written.node.title}（${formatIsoDate(written.node.date)}）` });
    setDate("");
    setTitle("");
    setNote("");
  }

  return (
    <div className="workspace workspace-docked">
      <StudentDock value={view} onChange={setView} />

      <WorkspaceBar
        role="student"
        name={session.name}
        accountId={session.accountId}
        detail={account?.detail ?? ""}
      />

      <main id="main-content" className="container workspace-main">
        <section className="workspace-hero" aria-labelledby="student-title">
          <p className="eyebrow">{view === "contact" ? "即时通信" : "毕业设计 · 进度追踪"}</p>
          <h1 className="workspace-title" id="student-title">
            {view === "contact" ? "联系导师" : "毕设进度"}
          </h1>

          {view === "contact" ? (
            <p className="workspace-lead">
              进度汇报、卡住的问题都可以直接发给导师。消息每 2 秒同步一次；
              演示版暂存在服务端内存，重启后会清空，接数据库后改为持久保存。
            </p>
          ) : (
            <dl className="stat-row">
              <div className="stat">
                <dt className="stat-label">最近一个学校节点</dt>
                <dd className="stat-value">{next ? next.title : "已无待办节点"}</dd>
                <dd className="stat-note">{next ? next.dateLabel : "以学院通知为准"}</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">我记录的节点</dt>
                <dd className="stat-value">{nodes.length}</dd>
                <dd className="stat-note">{latest ? `最近一次：${formatIsoDate(latest.date)}` : "还没有记录"}</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">今天</dt>
                <dd className="stat-value stat-value-mono">{today}</dd>
                <dd className="stat-note">倒计时按本地日期计算</dd>
              </div>
            </dl>
          )}
        </section>

        {view === "school" ? (
          <section className="timeline-section" aria-labelledby="school-title">
            <div className="section-head">
              <p className="eyebrow">计算机与软件学院 · 2027届</p>
              <h2 className="section-title" id="school-title">
                学院时间轴
              </h2>
              <p className="section-note">
                按《计算机与软件学院2027届本科毕业论文工作安排》整理。各环节须在规定节点内完成，
                逾期系统自动关闭，之后环节无法继续，论文只能为 F；标了「大概 / 预计」的日期，
                以学院届时通知为准。
              </p>
            </div>
            <SchoolTimeline milestones={SCHOOL_MILESTONES} today={today} />
          </section>
        ) : view === "mine" ? (
          <section className="timeline-section" aria-labelledby="mine-title">
            <div className="section-head">
              <p className="eyebrow">我的进度</p>
              <h2 className="section-title" id="mine-title">
                自己记录的节点
              </h2>
              <p className="section-note">
                和导师开过会、交了一稿、跑通了实验，都可以记一条。按日期排在时间轴上，
                导师也能在你的进度里看到这些记录。
              </p>
            </div>

            <form className="node-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="node-date">
                  日期
                </label>
                <input
                  id="node-date"
                  className="field-input"
                  type="date"
                  value={date || today}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setMessage(null);
                  }}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="node-title">
                  节点标题（最多 {NODE_TITLE_MAX} 字）
                </label>
                <input
                  id="node-title"
                  className="field-input"
                  value={title}
                  maxLength={NODE_TITLE_MAX}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setMessage(null);
                  }}
                  placeholder="例如：把开题报告的调研部分写完"
                />
              </div>

              <div className="node-form-actions">
                <button className="button-small" type="submit">
                  添加到时间轴
                </button>
              </div>

              <div className="field node-form-note">
                <label className="field-label" htmlFor="node-note">
                  备注（可选，最多 {NODE_NOTE_MAX} 字）
                </label>
                <input
                  id="node-note"
                  className="field-input"
                  value={note}
                  maxLength={NODE_NOTE_MAX}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setMessage(null);
                  }}
                  placeholder="例如：导师建议把范围收窄到方法对比"
                />
              </div>
            </form>

            {message ? (
              <p
                className={message.kind === "error" ? "error-text node-message" : "node-message node-message-ok"}
                role={message.kind === "error" ? "alert" : "status"}
              >
                {message.text}
              </p>
            ) : null}

            <ProgressWithMeetings
              nodes={nodes}
              studentId={accountId}
              mentorId={mentorId}
              onOpenContact={()=>setView("contact")}
              onRemove={(nodeId) => {
                removeNode(accountId, nodeId);
                setMessage(null);
              }}
            />

            <ProgressAiPanel
              studentId={accountId}
              mentorId={mentorId}
              mentorName={mentor?.name ?? "导师"}
              nodes={nodes}
              today={today}
              onOpenContact={() => setView("contact")}
            />

            <p className="gate-note">
              演示版：这些节点目前保存在本机浏览器里（换设备或清缓存会丢）。
              接入登录与数据库后改为保存到你的账号下，学校节点仍由学院统一维护。
            </p>
          </section>
        ) : (
          <section className="contact-section" aria-label="联系导师">
            <ContactPanel
              role="student"
              studentId={accountId}
              studentName={session.name}
              nodes={nodes}
              mentorId={mentorId}
              mentorName={mentor?.name ?? "导师"}
            />
          </section>
        )}
      </main>

      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>
    </div>
  );
}
