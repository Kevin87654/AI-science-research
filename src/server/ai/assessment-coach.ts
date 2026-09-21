import "server-only";

/**
 * 自适应测评的"教练"（B 负责）。
 *
 * 职责边界要守住：**它只决定"下一题问什么"，不决定"用户得几分"。**
 * 评分、阶段判定、画像生成全部仍由 `src/features/assessment` 里的纯函数完成，
 * 因为 PRD 要求评分使用可解释的确定性规则 —— 交给模型会让结果无法复现，也无法向学生解释。
 *
 * 降级链条（任何一环失败都不会让用户卡住）：
 *   没配密钥 / 调用失败 / 超时 / 返回非法题号  →  规则选题（`planNextQuestion`）
 */
import type { AssessmentStep, AssessmentStepRequest } from "@/contracts";
import {
  planNextQuestion,
  rankCandidates,
  summarizeAnswers,
  type QuestionCandidate,
} from "@/features/assessment/next-question";
import { DIMENSION_LABELS } from "@/features/assessment/question-bank";
import { askText, isAiConfigured } from "./codebuddy";

/** 追问文案长度上限：它是界面上的一句话，不是段落。 */
const MAX_PROBE_LENGTH = 80;
const MAX_REASON_LENGTH = 60;

type AiChoice = {
  questionId: string;
  probe: string | null;
  reason: string | null;
};

function clip(text: string, limit: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

/** 模型有时会套上 ```json 代码块或写点前言，所以只截取最外层的花括号。 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildPrompt(request: AssessmentStepRequest, candidates: QuestionCandidate[]): string {
  const summary = summarizeAnswers(request.mode, request.answers);
  const answeredText =
    summary.length > 0
      ? summary.map((entry) => `- ${entry.label}：${entry.answered}`).join("\n")
      : "（还没有任何作答，这是第一题）";

  const candidateText = candidates
    .map((candidate, index) => {
      const dimension = DIMENSION_LABELS[candidate.question.dimension];
      return `${index + 1}. id=${candidate.question.id} ｜ 维度=${dimension} ｜ ${candidate.question.type === "multi" ? "多选" : "单选"} ｜ 题目：${candidate.question.prompt}`;
    })
    .join("\n");

  const lastAnswer = summary.length > 0 ? summary[summary.length - 1].answered : null;

  return [
    "你在帮一个大学新生做「科研认知测评」。这不是考试，没有对错，目的是了解他现在的起点。",
    "",
    "【已经问到的回答】",
    answeredText,
    "",
    "【候选问题】只能从下面这些里挑一个，questionId 必须原样返回：",
    candidateText,
    "",
    "【挑选原则】",
    "1. 优先问能补上信息空白的方面；如果某方面他已经表现得很了解，就别再问那个方向的基础题。",
    "2. 他明确表示不了解的方面，不要追问细节，换一个角度或换个方面。",
    lastAnswer ? `3. 他上一条回答是「${lastAnswer}」，衔接它会让对话更自然。` : "3. 这是第一题，选一个容易开口、不会让人紧张的。",
    "",
    "【只输出一个 JSON 对象】，不要代码块标记、不要任何解释：",
    '{"questionId": "候选里的某个 id", "probe": "一句回应他的话，不超过 40 字", "reason": "为什么问这一题，不超过 30 字"}',
    "",
    "【关于 probe 的硬要求】",
    "- 它是自然衔接，不是评判：不要说「水平不错」「答错了」「你应该」。",
    "- 他明确说不了解时，用一句安抚或说明为什么这没关系。",
    "- 不确定该说什么就返回空字符串。",
  ].join("\n");
}

async function chooseWithAi(
  request: AssessmentStepRequest,
  candidates: QuestionCandidate[],
): Promise<{ candidate: QuestionCandidate; choice: AiChoice } | null> {
  const result = await askText(buildPrompt(request, candidates));
  if (!result.ok) {
    console.error(`[ai] 选题降级为规则：code=${result.code}`);
    return null;
  }

  const parsed = parseJsonObject(result.text);
  if (!parsed) {
    console.error("[ai] 选题降级为规则：返回内容不是 JSON");
    return null;
  }

  const questionId = typeof parsed.questionId === "string" ? parsed.questionId.trim() : "";
  const candidate = candidates.find((item) => item.question.id === questionId);
  if (!candidate) {
    // 模型编了一个不存在的题号：整条结果作废，绝不把未经验证的题放给用户。
    console.error("[ai] 选题降级为规则：题号不在候选内");
    return null;
  }

  return {
    candidate,
    choice: {
      questionId,
      probe: typeof parsed.probe === "string" && parsed.probe.trim().length > 0 ? clip(parsed.probe, MAX_PROBE_LENGTH) : null,
      reason: typeof parsed.reason === "string" && parsed.reason.trim().length > 0 ? clip(parsed.reason, MAX_REASON_LENGTH) : null,
    },
  };
}

/**
 * AI 介入的频率。
 *
 * ⚠️ **这是本轮实测出来的关键约束**：一次模型调用要 **25～45 秒**（其中约 13～15 秒是
 * CLI 子进程的固定启动开销，与提问长短无关）。所以"每答一题都问一次模型"会让整场测评
 * 光等待就 3～5 分钟 —— 对比赛演示是不可接受的。做成可配置，让团队按场合选：
 *
 * - `every`（当前默认）：**从第二题起**每题都由模型决定，最个性化，但每题要等 20～45 秒；
 * - `checkpoints`：每答完 3 题时交给模型，其余用规则推进（**演示推荐**）；
 * - `off`：完全不调用模型，纯规则（也用于本地快速回归）。
 *
 * 注：无论哪种模式，**第一题都用规则瞬时返回**（模型此时没有任何作答可参考）。
 *
 * 用 `SERVER_AI_STEP_MODE` 切换。默认取 `every` 是为了忠实实现"根据每一次回复引导提问"
 * 这个需求；要上台演示时建议切到 `checkpoints`。
 */
type StepMode = "every" | "checkpoints" | "off";

function resolveStepMode(): StepMode {
  const raw = process.env.SERVER_AI_STEP_MODE?.trim();
  return raw === "every" || raw === "checkpoints" || raw === "off" ? raw : "every";
}

function shouldAskAi(mode: StepMode, request: AssessmentStepRequest): boolean {
  if (mode === "off") return false;
  if (mode === "every") return true;
  // checkpoints：每答完 3 题，让模型重新读一遍全部作答并接管一次。
  // 第一题不在此列 —— 见下面"还没有作答就不叫模型"的说明。
  return request.answers.length > 0 && request.answers.length % 3 === 0;
}

export async function nextAssessmentStep(request: AssessmentStepRequest): Promise<AssessmentStep> {
  const ranking = rankCandidates({
    mode: request.mode,
    answers: request.answers,
    askedQuestionIds: request.askedQuestionIds,
  });

  const fallback = planNextQuestion(request);

  // 已经没有可问的题了，不必叫模型。
  if (ranking.candidates.length === 0) return fallback;
  // 只剩一个候选时模型没有任何决策空间，白等 20 多秒。
  if (ranking.candidates.length === 1) return fallback;
  /**
   * ⚠️ **还没有任何作答时，一律走规则出题。**
   *
   * 这时模型手里没有任何可个性化的依据，"它挑的第一题"和"规则的第一题"没有区别，
   * 却要让用户在最不能等的那一屏干等 20～45 秒（光 CLI 启动就 13～15 秒）。
   * 这一条是接到"点开始后等很久"的反馈后加的：第一题改为瞬时返回，
   * 个性化从第二题开始 —— 那时才有作答可供模型参考。
   */
  if (request.answers.length === 0) return fallback;
  if (!isAiConfigured()) return fallback;
  if (!shouldAskAi(resolveStepMode(), request)) return fallback;

  try {
    const picked = await chooseWithAi(request, ranking.candidates);
    if (!picked) return fallback;

    return {
      done: false,
      question: picked.candidate.question,
      probe: picked.choice.probe,
      // 模型没给理由时，沿用规则给出的解释，保证界面上永远有一句"为什么问这个"。
      reason: picked.choice.reason ?? picked.candidate.reason,
      decidedBy: "ai",
      progress: ranking.progress,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`[ai] 选题出现未预期错误，降级为规则：name=${name}`);
    return fallback;
  }
}
