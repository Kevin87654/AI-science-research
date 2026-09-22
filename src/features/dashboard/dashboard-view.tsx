"use client";

/**
 * 成长首页（B 负责）。
 *
 * 唯一的目标（PRD §11.1）：打开就看到"我现在在哪、下一步做什么"，
 * 而不是面对一个空白对话框。所以顺序是 阶段 → 下一项任务 → 进度 → 最近的记录，
 * "下一项推荐任务"永远排在信息密度更高的统计之前。
 *
 * 新用户与有进度用户看到的内容刻意不同（PRD §11.3）：
 * 没有画像时不摆假数据，直接给一个明确的行动入口。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProgressSnapshot } from "@/contracts";
import { loadProgress, toStatusMap } from "@/features/progress/progress-client";
import { ensureSession } from "@/features/shared/api-client";
import { formatDateTime, formatMinutes } from "@/features/shared/format";
import { useIsClient, useLocalFlow } from "@/features/shared/use-local-flow";

export function DashboardView() {
  const flow = useLocalFlow();
  const isClient = useIsClient();
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  const roadmapId = flow?.roadmap?.id ?? null;

  useEffect(() => {
    if (!roadmapId) return;

    void (async () => {
      const session = await ensureSession();
      if (!session.ok) {
        setProgressError(`${session.message}（进度暂时读不到。）`);
        return;
      }
      const result = await loadProgress(roadmapId);
      if (!result.ok) {
        setProgressError(result.message);
        return;
      }
      setSnapshot(result.data);
    })();
  }, [roadmapId]);

  if (!isClient) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在读取你的成长记录…
        </p>
      </section>
    );
  }

  if (!flow) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">成长首页</p>
        <h1>从一次测评开始</h1>
        <p className="muted">
          这里会显示你的科研阶段、下一项任务和已完成的事。现在还没有你的记录 ——
          做一次测评，几分钟后它就属于你了。
        </p>
        <Link className="button" href="/assessment">
          去做科研测评
        </Link>
      </section>
    );
  }

  const { profile, roadmap } = flow;
  const statusMap = toStatusMap(snapshot);

  const completedTasks = roadmap
    ? roadmap.tasks
        .filter((task) => statusMap.get(task.id)?.status === "completed")
        .map((task) => ({ task, updatedAt: statusMap.get(task.id)?.updatedAt ?? "" }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3)
    : [];

  const inProgressTask = roadmap
    ? roadmap.tasks.find((task) => statusMap.get(task.id)?.status === "in-progress")
    : undefined;

  const nextTask = roadmap
    ? roadmap.tasks.find((task) => {
        const status = statusMap.get(task.id)?.status ?? "not-started";
        return status === "not-started" || status === "in-progress";
      })
    : undefined;

  const completedCount = roadmap ? roadmap.tasks.filter((task) => statusMap.get(task.id)?.status === "completed").length : 0;

  return (
    <section className="panel" aria-labelledby="dashboard-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">成长首页</p>
          <h1 id="dashboard-title">{profile.stage.label}</h1>
          <p className="muted">{profile.summary.split("。")[0]}。</p>
        </div>
        {flow.isDemo ? <span className="badge badge-demo">演示数据</span> : null}
      </div>

      {progressError ? (
        <div className="notice notice-warn" role="alert">
          <p>{progressError}</p>
        </div>
      ) : null}

      {!roadmap ? (
        <article className="card card-highlight">
          <h2 className="card-title">下一步：把画像变成一条路线</h2>
          <p className="muted">
            你还没有学习路线。路线会把「想做科研」拆成几项有完成标准的小任务，每项都标了预计耗时。
          </p>
          <Link className="button" href="/roadmap">
            生成学习路线
          </Link>
        </article>
      ) : (
        <>
          <article className="card card-highlight">
            <h2 className="card-title">下一步做什么</h2>
            {nextTask ? (
              <>
                <p className="next-task-title">{nextTask.title}</p>
                <p className="muted small">{nextTask.description}</p>
                <p className="muted small">
                  预计 {formatMinutes(nextTask.estimatedMinutes)}
                  {inProgressTask && inProgressTask.id === nextTask.id ? " · 你上次停在了一项进行中的任务" : ""}
                </p>
                <Link className="button" href="/roadmap">
                  继续这项任务
                </Link>
              </>
            ) : (
              <>
                <p className="next-task-title">路线上的任务都处理完了</p>
                <p className="muted small">重新做一次测评，看看阶段有没有变化，或者换一条更进一步的路线。</p>
                <Link className="button" href="/assessment">
                  重新测评
                </Link>
              </>
            )}
          </article>

          <div className="grid-2">
            <article className="card">
              <h2 className="card-title">学习路线进度</h2>
              <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={roadmap.tasks.length} aria-valuenow={completedCount}>
                <span style={{ width: `${(completedCount / roadmap.tasks.length) * 100}%` }} />
              </div>
              <p className="muted small">
                已完成 {completedCount} / {roadmap.tasks.length} 项 · 路线：{roadmap.title}
              </p>
              <Link className="link-inline" href="/roadmap">
                查看完整路线 →
              </Link>
            </article>

            <article className="card">
              <h2 className="card-title">最近完成</h2>
              {completedTasks.length > 0 ? (
                <ul className="bullets">
                  {completedTasks.map(({ task, updatedAt }) => (
                    <li key={task.id}>
                      {task.title}
                      <span className="muted small"> · {formatDateTime(updatedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">还没有完成的任务。先做完一项，这里就会留下记录。</p>
              )}
            </article>
          </div>
        </>
      )}

      {/* 「推荐资料」模块此前只显示一句占位文案（"还在迁入主工程"），永远不会产出内容。
          2026-09-22 按 PRD v3 §4.1-A2 移除：宁可少一块，也不留一个永远空着的坑。
          要恢复的话请连同真实推荐一起做，不要再放占位文案。 */}
      <article className="card">
        <h2 className="card-title">兴趣方向</h2>
        {profile.interests.length > 0 ? (
          <ul className="tag-list">
            {profile.interests.map((interest) => (
              <li className="tag" key={interest.id}>
                {interest.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">还没有勾选方向。做完一次任务之后再来选，通常会更准。</p>
        )}
      </article>

      <div className="form-actions">
        <Link className="button-secondary" href="/profile">
          查看我的画像
        </Link>
        <Link className="button-ghost" href="/assessment">
          重新测评
        </Link>
      </div>
    </section>
  );
}
