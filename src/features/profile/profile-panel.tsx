"use client";

/**
 * 画像面板（B 负责）。
 *
 * 展示顺序刻意按 PRD §9.2 走，并把「优势」放在「待补能力」之前：
 * 用户打开这一页应该是"我知道自己从哪开始"，而不是先被列一串短板。
 * 页面底部一定有 `basis`（生成依据）——画像必须可解释，否则和算命没区别。
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getQuestionnaire } from "@/features/assessment/question-bank";
import { scoreAssessment } from "@/features/assessment/scoring";
import { planRoadmap } from "@/features/roadmap/plan-roadmap";
import { formatDateTime } from "@/features/shared/format";
import { buildFlow, saveFlow, type LocalFlow } from "@/features/shared/local-bridge";
import { useIsClient, useLocalFlow } from "@/features/shared/use-local-flow";

export function ProfilePanel() {
  const router = useRouter();
  const flow = useLocalFlow();
  const isClient = useIsClient();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function generateRoadmap(current: LocalFlow) {
    setBusy(true);
    setProblem(null);

    // 评分是纯函数，可以直接由提交重算，不需要在本地多存一份"结果"。
    const scoring = scoreAssessment(getQuestionnaire(current.submission.mode), current.submission);
    const createdAt = new Date().toISOString();

    const roadmap = planRoadmap({
      userId: current.profile.userId,
      profileId: current.profile.id,
      scoring,
      createdAt,
      isDemo: current.isDemo,
    });

    const saved = saveFlow(buildFlow({
      submission: current.submission,
      profile: current.profile,
      roadmap,
      savedAt: createdAt,
      isDemo: current.isDemo,
    }));

    setBusy(false);
    if (!saved.ok) {
      setProblem(saved.message);
      return;
    }
    router.push("/roadmap");
  }

  if (!isClient) {
    return (
      <section className="panel">
        <p className="muted" role="status">
          正在读取你的测评结果…
        </p>
      </section>
    );
  }

  if (!flow) {
    return (
      <section className="panel empty-state">
        <h1>还没有你的画像</h1>
        <p className="muted">花几分钟做一次科研认知测评，就能看到属于自己的阶段、优势与下一步。</p>
        <Link className="button" href="/assessment">
          去做科研测评
        </Link>
      </section>
    );
  }

  const { profile } = flow;

  return (
    <section className="panel" aria-labelledby="profile-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">科研画像</p>
          <h1 id="profile-title">{profile.stage.label}</h1>
        </div>
        {profile.isDemo ? <span className="badge badge-demo">演示数据</span> : null}
      </div>

      <p className="lead">{profile.summary}</p>

      {problem ? (
        <p className="error-text" role="alert">
          {problem}
        </p>
      ) : null}

      <div className="grid-2">
        <article className="card">
          <h2 className="card-title">你已经具备的</h2>
          <ul className="bullets">
            {profile.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2 className="card-title">接下来可以补的</h2>
          <ul className="bullets">
            {profile.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </article>
      </div>

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
          <p className="muted">
            你还没有勾选具体方向。这不影响开始 —— 先读一篇真实论文，比反复纠结选哪个更有效。
          </p>
        )}
      </article>

      <article className="card">
        <h2 className="card-title">建议优先完成的 3 个行动</h2>
        <ol className="action-list">
          {profile.priorityActions.map((action) => (
            <li key={action.id}>
              <p className="action-title">{action.title}</p>
              <p className="muted small">{action.rationale}</p>
            </li>
          ))}
        </ol>
      </article>

      <article className="card card-quiet">
        <h2 className="card-title">这份画像的依据</h2>
        <p className="muted small">{profile.basis}</p>
        <p className="muted small">
          生成时间：{formatDateTime(profile.generatedAt)}
          {flow.isDemo ? " · 由示例答案生成，仅用于演示" : ""}
        </p>
      </article>

      <div className="form-actions">
        {flow.roadmap ? (
          <Link className="button" href="/roadmap">
            查看我的学习路线
          </Link>
        ) : (
          <button type="button" className="button" onClick={() => generateRoadmap(flow)} disabled={busy}>
            {busy ? "正在规划…" : "根据画像生成学习路线"}
          </button>
        )}
        <Link className="button-secondary" href="/assessment">
          重新测评
        </Link>
      </div>
    </section>
  );
}
