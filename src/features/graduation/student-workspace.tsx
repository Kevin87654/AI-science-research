"use client";

/**
 * 大四学生工作台：毕设进度追踪（流态旋转时间轴）。
 *
 * 这一版把原来的两条独立时间轴合并成一块舞台：
 *   · 左半边 = **学生自己记的**进度（可增删，落在本机）；
 *   · 右半边 = **学院下达的**统一节点（人人相同，不能改）；
 *   · 中间 = 「今天」，两侧轨道随滚动与指针轻微转动。
 * 学院节点卡只保留日期 / 状态 / 标题，完整说明与材料清单点开后再看 ——
 * 14 个节点如果全部铺开，页面会变成一篇没人读完的长文。
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
import { OrbitTimeline } from "./orbit-timeline";
import { ProgressAiPanel } from "./progress-ai-panel";
import { formatIsoDate, latestByDate, pickNextMilestone, toLocalIsoDate } from "./timeline-meta";
import { useMentorGroupsState } from "./use-mentor-groups";
import { useStudentNodesState } from "./use-student-nodes";
import { WorkspaceBar } from "./workspace-bar";

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
  /** 合并后只剩时间轴与联系导师两块；默认落在时间轴上。 */
  const [view, setView] = useState<StudentView>("timeline");

  // 切换侧栏视图后回到顶部：否则从很长的时间轴切到「联系导师」，
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

  /** 表单由工作台维护状态，交给时间轴组件放进左半场，展开时才显示。 */
  const composer = (
    <>
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

        <div className="field">
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

        <div className="node-form-actions">
          <button className="button-small" type="submit">
            添加到时间轴
          </button>
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
    </>
  );

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

        {view === "timeline" ? (
          <section className="timeline-section" aria-labelledby="timeline-title">
            <div className="section-head">
              <p className="eyebrow">毕业设计 · 流态旋转时间轴</p>
              <h2 className="section-title" id="timeline-title">
                双轨时间轴
              </h2>
              <p className="section-note">
                左半边是你自己记录的进度，右半边是学院统一节点，两条轨道绕着中间的「今天」转动。
                两侧各显示 3 个节点，滚轮上下翻看；学院节点只保留日期、状态与标题，点击后在浮层里展开完整说明与材料清单。
              </p>
            </div>

            <OrbitTimeline
              milestones={SCHOOL_MILESTONES}
              nodes={nodes}
              today={today}
              next={next}
              composer={composer}
              assistant={
                <ProgressAiPanel
                  studentId={accountId}
                  mentorId={mentorId}
                  mentorName={mentor?.name ?? "导师"}
                  nodes={nodes}
                  today={today}
                  onOpenContact={() => setView("contact")}
                />
              }
              onRemove={(nodeId) => {
                removeNode(accountId, nodeId);
                setMessage(null);
              }}
            />

            <p className="gate-note">
              演示版：自己记录的节点保存在本机浏览器里（换设备或清缓存会丢）。
              接入登录与数据库后改为保存到你的账号下，学院节点仍由学院统一维护。
            </p>
          </section>
        ) : (
          <section className="contact-section" aria-label="联系导师">
            <ContactPanel
              role="student"
              studentId={accountId}
              studentName={session.name}
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
