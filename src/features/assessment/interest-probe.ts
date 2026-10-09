/**
 * 兴趣探测（B 负责）—— 测评开头的启发式提问，**取代**旧的兴趣勾选题。
 *
 * 为什么是"探测"而不是"勾选"：旧 `q-interest` 直接问「你对哪个方向感兴趣」，
 * 用户（尤其大一新生）未必说得清自己感兴趣什么；改成从**侧面问题**里推断，
 * 能测出"用户自己都未必意识到"的兴趣方向（第二轮拍板，见分工文档 §3）。
 *
 * 与评分的关系：探测结果**不参与能力评分**（和旧兴趣题一样不计分），
 * 它只作为「兴趣领域」喂给画像、路线论文推荐和刊物科普。
 */
import type { InterestProbeResult, InterestTag } from "@/contracts";

/** 兴趣方向目录：id → 展示名。id 沿用旧 `q-interest` 的选项 id，供下游刊物/论文数据引用。 */
export const INTEREST_DIRECTIONS: Record<string, string> = {
  "it-ai": "人工智能",
  "it-robotics": "机器人",
  "it-data": "数据科学",
  "it-bio": "生物医学",
  "it-material": "材料与能源",
  "it-hci": "人机交互",
  "it-security": "网络安全",
};

export type ProbeOption = {
  id: string;
  label: string;
  /** 选中这个选项 → 命中的兴趣方向 id 列表。 */
  directionIds: string[];
};

export type ProbeQuestion = {
  id: string;
  prompt: string;
  type: "single" | "multi";
  options: ProbeOption[];
};

/** 启发式问题集：一道风格题（粗筛）+ 一道内容题（精确定位）。 */
export const PROBE_QUESTIONS: ProbeQuestion[] = [
  {
    id: "q-probe-style",
    prompt: "如果有一个下午可以自由折腾，你更想做什么？",
    type: "single",
    options: [
      { id: "style-reason", label: "搞懂一个模型或算法是怎么工作的", directionIds: ["it-ai", "it-data"] },
      { id: "style-build", label: "动手把一件东西做出来、让它跑起来", directionIds: ["it-robotics", "it-material"] },
      { id: "style-experience", label: "设计一个让人用起来舒服的东西", directionIds: ["it-hci", "it-bio"] },
    ],
  },
  {
    id: "q-probe-topic",
    prompt: "刷到下面哪些内容，你会忍不住停下来看？（可多选）",
    type: "multi",
    options: [
      { id: "topic-ai", label: "AI 又学会了什么新本事", directionIds: ["it-ai"] },
      { id: "topic-robotics", label: "机器人 / 自动驾驶的新进展", directionIds: ["it-robotics"] },
      { id: "topic-data", label: "用数据讲出来的有趣结论", directionIds: ["it-data"] },
      { id: "topic-bio", label: "医疗、健康里的新技术", directionIds: ["it-bio"] },
      { id: "topic-material", label: "新材料、新能源的突破", directionIds: ["it-material"] },
      { id: "topic-hci", label: "一个特别好用的新 App / 产品", directionIds: ["it-hci"] },
      { id: "topic-security", label: "黑客、漏洞、隐私安全的新闻", directionIds: ["it-security"] },
    ],
  },
];

export type ProbeAnswer = {
  questionId: string;
  optionIds: string[];
};

function toInterestTag(directionId: string): InterestTag | null {
  const label = INTEREST_DIRECTIONS[directionId];
  if (!label) return null;
  return { id: directionId, label, source: "derived" };
}

/**
 * 兴趣探测主入口。
 *
 * 判定规则（写死在这里，便于解释与测试）：
 * - **精确题**（`q-probe-topic`，多选）命中的方向优先；
 * - 精确题没选时，回退到**风格题**（`q-probe-style`）的粗筛方向；
 * - 去重、按方向目录顺序；两道都没答 → 空结果。
 */
export function probeInterests(answers: ProbeAnswer[]): InterestProbeResult {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));

  const hitFrom = (questionId: string): string[] => {
    const question = PROBE_QUESTIONS.find((candidate) => candidate.id === questionId);
    if (!question) return [];
    const answer = byId.get(questionId);
    if (!answer) return [];
    return answer.optionIds.flatMap((optionId) => {
      const option = question.options.find((candidate) => candidate.id === optionId);
      return option ? option.directionIds : [];
    });
  };

  const exact = hitFrom("q-probe-topic");
  const fallback = exact.length > 0 ? [] : hitFrom("q-probe-style");

  const directionIds = Array.from(new Set([...exact, ...fallback]));
  const interests = directionIds.map(toInterestTag).filter((tag): tag is InterestTag => tag !== null);

  const labels = interests.map((interest) => interest.label).join("、");
  const rationale =
    interests.length === 0
      ? "你还没有明确表现出对某个方向的偏好，先从一个具体方向读起，比空想更容易找到感觉。"
      : `依据你对工作方式与内容偏好的选择，推断你可能对「${labels}」方向更感兴趣。`;

  return { interests, rationale };
}

/**
 * 演示用的探测作答（PRD §18.2 示例用户：对 AI 与机器人、数据科学有兴趣）。
 * 与 `DEMO_ANSWERS` 配套，供「用示例答案直接看结果」的快速通道使用。
 */
export const DEMO_PROBE_ANSWERS: ProbeAnswer[] = [
  { questionId: "q-probe-style", optionIds: ["style-reason"] },
  { questionId: "q-probe-topic", optionIds: ["topic-ai", "topic-robotics", "topic-data"] },
];
