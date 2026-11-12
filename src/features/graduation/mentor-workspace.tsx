"use client";

/**
 * 导师工作台：搜索学生 → 加入小组 → 查看组内学生的进度。
 *
 * 三个决定：
 * 1. **搜索不返回全部学生**，必须输入关键词。真实实现里这是一次带索引的查询，
 *    不能做成"先把所有学生拉下来再过滤"（数据层约定里明确禁止查全表）。
 * 2. 加入小组只是建立关系，**不复制学生的进度** —— 进度永远只有一份，
 *    学生自己改了，导师这边立刻看到的就是新的。
 * 3. 右栏的进度是**只读**的（不传 `onRemove`）：导师可以看，但不替学生改记录。
 *
 * 演示数据：账号来自 `demo-accounts.ts`，小组关系放在本机浏览器（`mentor-groups.ts`）。
 */
import { useEffect, useState } from "react";

import { findAccountById, searchStudents, type DemoAccount } from "@/features/auth/demo-accounts";
import { useRoleSession } from "@/features/auth/use-role-session";
import { useIsClient } from "@/features/shared/use-local-flow";
import { addStudent, removeStudent, studentsOf } from "./mentor-groups";
import { MentorDock, type MentorView } from "./mentor-dock";
import { ContactPanel } from "./contact-panel";
import { RoleGate } from "./role-gate";
import { nodesFor } from "./student-nodes";
import { StudentNodeTimeline } from "./timeline";
import { formatIsoDate, latestByDate } from "./timeline-meta";
import { useMentorGroupsState } from "./use-mentor-groups";
import { useStudentNodesState } from "./use-student-nodes";
import { WorkspaceBar } from "./workspace-bar";

type Notice = { kind: "ok" | "error"; text: string } | null;

export function MentorWorkspace() {
  const isClient = useIsClient();
  const session = useRoleSession();
  const groupsState = useMentorGroupsState();
  const nodesState = useStudentNodesState();

  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState<MentorView>("progress");

  // 与学端一致：切换侧栏视图后回到顶部，避免落在上一页的中间位置。
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  if (!isClient) return <div className="workspace-loading" aria-busy="true" />;
  if (!session || session.role !== "mentor") return <RoleGate role="mentor" />;

  const mentorId = session.accountId;
  const mentor = findAccountById(mentorId);
  const studentIds = studentsOf(groupsState, mentorId);
  const students = studentIds
    .map((id) => findAccountById(id))
    .filter((account): account is DemoAccount => account !== null);

  const results = searched === null ? [] : searchStudents(searched);
  const selected = selectedId && studentIds.includes(selectedId) ? selectedId : (studentIds[0] ?? null);
  const selectedAccount = selected ? findAccountById(selected) : null;
  const selectedNodes = selected ? nodesFor(nodesState, selected) : [];
  const selectedLatest = latestByDate(selectedNodes);
  const totalNodes = students.reduce((sum, student) => sum + nodesFor(nodesState, student.id).length, 0);

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = keyword.trim();
    setSearched(target);
    setNotice(null);
  }

  function handleAdd(account: DemoAccount) {
    const outcome = addStudent(mentorId, account.id);
    if (!outcome.ok) {
      setNotice({ kind: "error", text: outcome.message });
      return;
    }
    if (!outcome.added) {
      setNotice({ kind: "ok", text: `${account.name} 已经在你的小组里了。` });
      return;
    }
    setNotice({ kind: "ok", text: `已把 ${account.name}（${account.id}）加入小组。` });
    setSelectedId(account.id);
  }

  function handleRemove(account: DemoAccount) {
    if (!removeStudent(mentorId, account.id)) return;
    setNotice({ kind: "ok", text: `已把 ${account.name} 移出小组。` });
    setSelectedId(null);
  }

  return (
    <div className="workspace workspace-docked">
      <MentorDock value={view} onChange={setView} />

      <WorkspaceBar
        role="mentor"
        name={session.name}
        accountId={session.accountId}
        detail={mentor?.detail ?? ""}
      />

      <main id="main-content" className="container workspace-main">
        <section className="workspace-hero" aria-labelledby="mentor-title">
          <p className="eyebrow">{view === "contact" ? "即时通信" : "毕业设计 · 导师管理"}</p>
          <h1 className="workspace-title" id="mentor-title">
            {view === "contact" ? "联系学生" : "导师管理"}
          </h1>
          <p className="workspace-lead">
            {view === "progress"
              ? "按学号搜索学生并加入小组，然后在右栏查看他记录的进度。学生自己更新的节点会直接反映在这里。"
              : "选一位组内学生开始对话：进度汇报、卡住的问题、下一步安排，都可以直接说。"}
          </p>

          {view === "contact" ? null : (
            <dl className="stat-row">
              <div className="stat">
                <dt className="stat-label">组内学生</dt>
                <dd className="stat-value">{students.length}</dd>
                <dd className="stat-note">按学号搜索后添加</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">组内节点总数</dt>
                <dd className="stat-value">{totalNodes}</dd>
                <dd className="stat-note">学生自行记录的进度条目</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">我的工号</dt>
                <dd className="stat-value stat-value-mono">{session.accountId}</dd>
                <dd className="stat-note">{session.name}</dd>
              </div>
            </dl>
          )}
        </section>

        {view === "progress" ? (
          <div className="mentor-grid">
          <div className="mentor-col">
            <section className="card" aria-labelledby="add-title">
              <h2 className="card-title" id="add-title">
                添加学生
              </h2>
              <p className="section-note">
                输入学号或姓名搜索。演示版目前只有 1 个学生账号：<code>20220001</code>。
              </p>

              <form className="mentor-search" onSubmit={handleSearch}>
                <label className="visually-hidden" htmlFor="mentor-search">
                  学号或姓名
                </label>
                <input
                  id="mentor-search"
                  className="field-input"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="例如 20220001 或 林"
                />
                <button className="button-small" type="submit">
                  搜索
                </button>
              </form>

              {notice ? (
                <p
                  className={notice.kind === "error" ? "error-text mentor-notice" : "node-message node-message-ok mentor-notice"}
                  role={notice.kind === "error" ? "alert" : "status"}
                >
                  {notice.text}
                </p>
              ) : null}

              {searched === null ? null : results.length === 0 ? (
                <p className="mentor-empty">
                  {searched.trim().length === 0
                    ? "请输入学号或姓名再搜索。"
                    : `没有找到「${searched}」对应的学生账号。`}
                </p>
              ) : (
                <ul className="search-list">
                  {results.map((account) => {
                    const inGroup = studentIds.includes(account.id);
                    return (
                      <li className="search-row" key={account.id}>
                        <span className="search-main">
                          <span className="search-name">{account.name}</span>
                          <span className="search-meta">
                            {account.id} · {account.detail}
                          </span>
                        </span>
                        {inGroup ? (
                          <span className="tag">已在组内</span>
                        ) : (
                          <button className="button-small" type="button" onClick={() => handleAdd(account)}>
                            添加
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="group-title">
              <h2 className="card-title" id="group-title">
                我的学生（{students.length}）
              </h2>

              {students.length === 0 ? (
                <p className="mentor-empty">
                  还没有学生。搜索学号 <code>20220001</code> 并点「添加」，就能在这里看到他的进度。
                </p>
              ) : (
                <ul className="student-list">
                  {students.map((student) => {
                    const active = selected === student.id;
                    const nodes = nodesFor(nodesState, student.id);
                    return (
                      <li className={active ? "student-row student-row-active" : "student-row"} key={student.id}>
                        <button
                          className="student-row-main"
                          type="button"
                          onClick={() => setSelectedId(student.id)}
                          aria-current={active ? "true" : undefined}
                        >
                          <span className="student-name">{student.name}</span>
                          <span className="student-meta">
                            {student.id} · {nodes.length} 个节点
                          </span>
                        </button>
                        <button
                          className="button-ghost student-remove"
                          type="button"
                          onClick={() => handleRemove(student)}
                          aria-label={`把 ${student.name} 移出小组`}
                        >
                          移出
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="card mentor-progress" aria-labelledby="progress-title">
            <h2 className="card-title" id="progress-title">
              学生进度
            </h2>

            {selectedAccount && selected ? (
              <>
                <div className="student-profile">
                  <div>
                    <p className="student-profile-name">
                      {selectedAccount.name}
                      <span className="role-chip">学生</span>
                    </p>
                    <p className="student-profile-meta">
                      {selectedAccount.id} · {selectedAccount.affiliation}
                    </p>
                    <p className="student-profile-meta">{selectedAccount.detail}</p>
                  </div>
                  <div className="student-profile-stats">
                    <span className="stat-label">节点</span>
                    <span className="stat-value">{selectedNodes.length}</span>
                    <span className="stat-note">
                      {selectedLatest ? `最近 ${formatIsoDate(selectedLatest.date)}` : "暂无记录"}
                    </span>
                  </div>
                </div>

                <div className="mentor-timeline">
                  <p className="section-note">
                    下面是他自己记录的节点，按日期排列。学院统一的时间轴节点对所有学生都一样，
                    见学生端「学院时间轴」。
                  </p>
                  <StudentNodeTimeline
                    nodes={selectedNodes}
                    emptyHint="这位学生还没有记录任何节点。提醒他登录学生端，把已完成的进度记一条。"
                  />
                </div>
              </>
            ) : (
              <p className="mentor-empty">先在左边添加学生，这里会显示他记录的进度时间轴。</p>
            )}
          </section>
          </div>
        ) : (
          <section className="contact-section" aria-label="联系学生">
            {students.length === 0 ? (
              <p className="mentor-empty">
                还没有学生。先切到「学生进度」，搜索学号 <code>20220001</code> 并添加，就能在这里联系他。
              </p>
            ) : (
              <div className="contact-grid">
                <section className="card" aria-labelledby="contact-students-title">
                  <h2 className="card-title" id="contact-students-title">
                    选择学生
                  </h2>
                  <ul className="student-list">
                    {students.map((student) => {
                      const active = selected === student.id;
                      return (
                        <li
                          className={active ? "student-row student-row-active" : "student-row"}
                          key={student.id}
                        >
                          <button
                            className="student-row-main"
                            type="button"
                            onClick={() => setSelectedId(student.id)}
                            aria-current={active ? "true" : undefined}
                          >
                            <span className="student-name">{student.name}</span>
                            <span className="student-meta">{student.id}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {selectedAccount ? (
                  <ContactPanel
                    key={selectedAccount.id}
                    role="mentor"
                    studentId={selectedAccount.id}
                    studentName={selectedAccount.name}
                    mentorId={mentorId}
                    mentorName={session.name}
                  />
                ) : null}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>
    </div>
  );
}
