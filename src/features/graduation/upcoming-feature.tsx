"use client";

/**
 * 学生侧栏里的两个「后续开发入口」：兴趣课题探测、导师资料问答。
 *
 * 这一轮**只加入口，不做功能**：没有数据源、没有表单、没有接口调用。
 * 页面把「待开发」写清楚，避免用户以为点了没反应是 bug；
 * 下面的三步是给后续开发留的范围说明，不是已经可用的能力。
 */
export type UpcomingFeatureKey = "interest" | "mentor-rag";

interface UpcomingFeatureCopy {
  eyebrow: string;
  title: string;
  lead: string;
  code: string;
  heading: string;
  points: readonly { title: string; text: string }[];
  note: string;
}

export const UPCOMING_FEATURES: Record<UpcomingFeatureKey, UpcomingFeatureCopy> = {
  interest: {
    eyebrow: "后续开发入口",
    title: "兴趣课题探测",
    lead: "从你感兴趣的方向出发，探测可落地的毕设课题；未来会结合学院课题与导师方向给出匹配建议。",
    code: "ENTRY 02 · INTEREST",
    heading: "计划中的三步",
    points: [
      {
        title: "兴趣盘点",
        text: "用几组问题把「想做什么」收敛到 1–2 个方向：视觉、NLP、系统、人机交互等。",
      },
      {
        title: "课题匹配",
        text: "把方向映射到学院可选的课题与导师研究领域，给出可做的题目清单。",
      },
      {
        title: "可行性提示",
        text: "结合周期、数据与工具条件提示风险，避免选一个做不完的题。",
      },
    ],
    note: "本轮只保留入口：没有数据源，也没有可提交的表单。",
  },
  "mentor-rag": {
    eyebrow: "后续开发入口",
    title: "导师资料问答",
    lead: "用自然语言查深大导师的研究方向、招生偏好与可指导课题；基于导师资料库检索（RAG），先找证据再回答。",
    code: "ENTRY 03 · MENTOR RAG",
    heading: "计划中的三步",
    points: [
      {
        title: "资料入库",
        text: "把导师主页、公开论文与学院资料整理成可检索的导师资料库。",
      },
      {
        title: "检索回答",
        text: "先检索证据再生成回答，每条结论附来源，避免模型凭空编造。",
      },
      {
        title: "选导师对照",
        text: "按研究方向、指导风格与可指导课题筛选，生成对照清单。",
      },
    ],
    note: "本轮只保留入口：不接导师库，也不提供问答或联系方式。",
  },
};

export function UpcomingFeature({
  feature,
  onBack,
}: {
  feature: UpcomingFeatureKey;
  onBack: () => void;
}) {
  const copy = UPCOMING_FEATURES[feature];

  return (
    <section className="soon" aria-labelledby="soon-heading">
      <header className="soon-head">
        <span className="soon-stamp">待开发 · NOT IMPLEMENTED</span>
        <span className="soon-code">{copy.code}</span>
      </header>

      <div className="soon-body">
        <h2 className="soon-heading" id="soon-heading">
          {copy.heading}
        </h2>

        <ol className="soon-grid">
          {copy.points.map((point, index) => (
            <li className="soon-card" key={point.title}>
              <span className="soon-index">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="soon-card-title">{point.title}</h3>
              <p className="soon-card-text">{point.text}</p>
            </li>
          ))}
        </ol>

        <div className="soon-foot">
          <p className="soon-note">{copy.note}</p>
          <button className="button-secondary" type="button" onClick={onBack}>
            ← 回到毕设时间轴
          </button>
        </div>
      </div>
    </section>
  );
}
