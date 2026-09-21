"use client";

/**
 * 学习路线任务板（B 负责）。
 *
 * 进度**只从服务端读写**（`/api/progress`）。之所以不在本地留一份：
 * A 的接口每一条记录都带服务端确认的用户归属，本地副本既没有归属校验，
 * 也会在刷新/换标签页时和真身分叉。宁可多一次请求，也不要两份状态。
 *
 * 因此这里把"请求失败"当成一等状态处理：明确提示 + 可重试（PRD §19.3），
 * 而不是偷偷用本地值糊过去。
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProgressSnapshot, RoadmapTask, TaskProgressStatus } from "@/contracts";
import { getQuestionnaire } from "@/features/assessment/question-bank";
import { scoreAssessment } from "@/features/assessment/scoring";
import { loadProgress, saveTaskProgress, toStatusMap } from "@/features/progress/progress-client";
import { ensureSession } from "@/features/shared/api-client";
import { formatMinutes, formatWeeks, TASK_STATUS_LABELS } from "@/features/shared/format";
import { buildFlow, saveFlow, type LocalFlow } from "@/features/shared/local-bridge";
import { useIsClient, useLocalFlow } from "@/features/shared/use-local-flow";
import { planRoadmap, totalEstimatedMinutes } from "./plan-roadmap";

const NOTE_MAX_LENGTH = 500;

/** 取数的结果：要么拿到快照，要么拿到一句给用户看的错误。 */
type ProgressOutcome = { snapshot: ProgressSnapshot | null; error: string | null };

export function RoadmapBoard() {
  const router = useRouter();
  const flow = useLocalFlow();
  const isClient = useIsClient();
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const roadmap = flow?.roadmap ?? null;
  const roadmapId = roadmap?.id ?? null;

  /**
   * 只负责取数，**不改状态**：这样 effect 里调它就不算"在副作用里同步改状态"。
   * 状态的落地交给调用方（effect 里在 await 之后更新，或事件处理器里更新）。
   */
  const fetchProgress = useCallback(async (id: string): Promise<ProgressOutcome> => {
    const session = await ensureSession();
    if (!session.ok) {
      return { snapshot: null, error: `${session.message}（进度暂时无法读取或保存。）` };
    }

    const result = await loadProgress(id);
    if (!result.ok) return { snapshot: null, error: result.message };

    return { snapshot: result.data, error: null };
  }, []);

  /** 事件处理器里用：把取数结果直接落到界面上。 */
  async function reloadProgress(id: string) {
    const outcome = await fetchProgress(id);
    if (outcome.error) {
      setProgressError(outcome.error);
      return;
    }
    setProgressError(null);
    setSnapshot(outcome.snapshot);
  }

  useEffect(() => {
    if (!roadmapId) return;

    void (async () => {
      const outcome = await fetchProgress(roadmapId);
      if (outcome.error) {
        setProgressError(outcome.error);
        return;
      }
      setProgressError(null);
      setSnapshot(outcome.snapshot);
    })();
  }, [roadmapId, fetchProgress]);

  function generateRoadmap(current: LocalFlow) {
    setProblem(null);
    const scoring = scoreAssessment(getQuestionnaire(current.submission.mode), current.submission);
    const createdAt = new Date().toISOString();

    const next = planRoadmap({
      userId: current.profile.userId,
      profileId: current.profile.id,
      scoring,
      createdAt,
      isDemo: current.isDemo,
    });

    const saved = saveFlow(
      buildFlow({
        submission: current.submission,
        profile: current.profile,
        roadmap: next,
        savedAt: createdAt,
        isDemo: current.isDemo,
      }),
    );

    if (!saved.ok) {
      setProblem(saved.message);
      return;
    }

    // 不用手动同步状态：saveFlow 会广播变更，订阅它的组件会自动拿到新路线。
    void reloadProgress(next.id);
  }

  async function updateStatus(task: RoadmapTask, status: TaskProgressStatus, note?: string) {
    if (!roadmap) return;

    setPendingTaskId(task.id);
    setProblem(null);

    const result = await saveTaskProgress({
      roadmapId: roadmap.id,
      taskId: task.id,
      status,
      note: note ?? noteDrafts[task.id] ?? null,
    });

    setPendingTaskId(null);

    if (!result.ok) {
      // 失败就原样保留界面状态，让用户自己决定是否重试，不假装成功。
      setProblem(`${result.message}（这项任务的状态没有保存成功。）`);
      return;
    }

    setSnapshot(result.data);
    setProgressError(null);
  }

  if (!isClient) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在读取学习路线…
        </p>
      </section>
    );
  }

  if (!flow) {
    return (
      <section className="panel empty-state">
        <h1>还没有学习路线</h1>
        <p className="muted">路线由你的画像生成。先完成一次测评，我们才知道该给你排什么任务。</p>
        <Link className="button" href="/assessment">
          去做科研测评
        </Link>
      </section>
    );
  }

  if (!roadmap) {
    return (
      <section className="panel empty-state">
        <h1>路线还没生成</h1>
        <p className="muted">你的画像已经有了，下一步把它拆成有顺序、有完成标准的任务。</p>
        {problem ? (
          <p className="error-text" role="alert">
            {problem}
          </p>
        ) : null}
        <button type="button" className="button" onClick={() => generateRoadmap(flow)}>
          生成学习路线
        </button>
      </section>
    );
  }

  const statusMap = toStatusMap(snapshot);
  const completedCount = roadmap.tasks.filter((task) => statusMap.get(task.id)?.status === "completed").length;
  const totalMinutes = totalEstimatedMinutes(roadmap);

  return (
    <section className="panel" aria-labelledby="roadmap-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">学习路线</p>
          <h1 id="roadmap-title">{roadmap.title}</h1>
          <p className="lead">{roadmap.goal}</p>
        </div>
        {roadmap.isDemo ? <span className="badge badge-demo">演示数据</span> : null}
      </div>

      <p className="muted small">
        建议 {formatWeeks(roadmap.suggestedWeeks)}完成 · 共 {roadmap.tasks.length} 项任务 · 预计投入{" "}
        {formatMinutes(totalMinutes)}
      </p>

      <div className="progress-block">
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={roadmap.tasks.length}
          aria-valuenow={completedCount}
        >
          <span style={{ width: `${(completedCount / roadmap.tasks.length) * 100}%` }} />
        </div>
        <p className="muted small">
          已完成 {completedCount} / {roadmap.tasks.length} 项
        </p>
      </div>

      {progressError ? (
        <div className="notice notice-warn" role="alert">
          <p>{progressError}</p>
          <button type="button" className="button-secondary" onClick={() => void reloadProgress(roadmap.id)}>
            重试
          </button>
        </div>
      ) : null}

      {problem ? (
        <p className="error-text" role="alert">
          {problem}
        </p>
      ) : null}

      {roadmap.stages.map((stage) => {
        const stageTasks = roadmap.tasks.filter((task) => task.stageId === stage.id);
        return (
          <article className="stage" key={stage.id}>
            <header className="stage-header">
              <span className="stage-index" aria-hidden="true">
                {stage.order}
              </span>
              <div>
                <h2 className="stage-title">{stage.title}</h2>
                <p className="muted small">{stage.description}</p>
              </div>
            </header>

            <ul className="task-list">
              {stageTasks.map((task) => {
                const entry = statusMap.get(task.id);
                const status: TaskProgressStatus = entry?.status ?? "not-started";
                const pending = pendingTaskId === task.id;

                return (
                  <li className={`task task-${status}`} key={task.id}>
                    <div className="task-main">
                      <div className="task-head">
                        <h3>{task.title}</h3>
                        <span className={`status-pill status-${status}`}>{TASK_STATUS_LABELS[status]}</span>
                      </div>
                      <p className="muted small">{task.description}</p>

                      <dl className="task-meta">
                        <div>
                          <dt>预计耗时</dt>
                          <dd>{formatMinutes(task.estimatedMinutes)}</dd>
                        </div>
                        <div>
                          <dt>完成标准</dt>
                          <dd>
                            <ul className="criteria">
                              {task.completionCriteria.map((criteria) => (
                                <li key={criteria}>{criteria}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      </dl>

                      <div className="task-actions">
                        {status !== "completed" ? (
                          <button
                            type="button"
                            className="button-small"
                            disabled={pending}
                            onClick={() => void updateStatus(task, "completed")}
                          >
                            标记为完成
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button-secondary"
                            disabled={pending}
                            onClick={() => void updateStatus(task, "not-started")}
                          >
                            撤销完成
                          </button>
                        )}

                        {status === "not-started" ? (
                          <button
                            type="button"
                            className="button-ghost"
                            disabled={pending}
                            onClick={() => void updateStatus(task, "in-progress")}
                          >
                            标记为进行中
                          </button>
                        ) : null}

                        {task.skippable && status !== "skipped" ? (
                          <button
                            type="button"
                            className="button-ghost"
                            disabled={pending}
                            onClick={() => void updateStatus(task, "skipped")}
                          >
                            跳过这项
                          </button>
                        ) : null}

                        {status === "skipped" ? (
                          <button
                            type="button"
                            className="button-ghost"
                            disabled={pending}
                            onClick={() => void updateStatus(task, "not-started")}
                          >
                            重新开始这项
                          </button>
                        ) : null}
                      </div>

                      <div className="note-row">
                        <label className="visually-hidden" htmlFor={`note-${task.id}`}>
                          {task.title}的个人备注
                        </label>
                        <input
                          id={`note-${task.id}`}
                          className="note-input"
                          type="text"
                          maxLength={NOTE_MAX_LENGTH}
                          placeholder="记一句自己的进展或卡住的地方（可留空）"
                          value={noteDrafts[task.id] ?? entry?.note ?? ""}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({ ...current, [task.id]: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="button-ghost"
                          disabled={pending}
                          onClick={() => void updateStatus(task, status)}
                        >
                          保存备注
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}

      <div className="form-actions">
        <Link className="button" href="/dashboard">
          回到成长首页
        </Link>
        <button type="button" className="button-ghost" onClick={() => router.push("/profile")}>
          查看画像
        </button>
      </div>
    </section>
  );
}
