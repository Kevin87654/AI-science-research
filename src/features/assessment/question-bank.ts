/**
 * 测评题库（B 负责）。
 *
 * 这里是"题目内容"的唯一来源。与第一版相比，最重要的变化是每道题多了 `level`：
 *
 * - `core`：每个能力维度的**必问**题，用来判断"这一块用户大概在哪一档"；
 * - `deepen`：**只在核心题答得不错时才问**，用来把"有一点基础"和"已经能做"分开。
 *
 * 这样自适应提问才有真实的决策空间：答得浅的维度不再追问（省时间，也不让人觉得被考），
 * 答得好的维度才深挖一道。**题量因此是因人而异的，而不是固定 14 题。**
 *
 * 三条产品约束直接体现在数据里：
 * 1. 认知类题目的选项分值是 1～3，**没有 0 分选项**；真的没概念时走 `unknown`
 *    （「不知道」是标记，不是选项），这样"诚实地不知道"和"答得很浅"不会混为一谈。
 * 2. 兴趣方向与目标时间**不计分**（`score: null`）：它们是偏好，不是能力。
 *    哪些维度参与评分见 `scoring.ts` 的 `DIMENSION_KIND`。
 * 3. 措辞不出现"考试""水平差"这类评价性表达（PRD §8.3）。
 */
import type {
  AssessmentAnswer,
  AssessmentDimension,
  AssessmentMode,
  AssessmentOption,
  AssessmentQuestion,
  AssessmentQuestionnaire,
  AssessmentQuestionType,
} from "@/contracts";

const SCHEMA_VERSION = "1.0.0";

/** 题目层级：核心题必问，深入题按上一题表现决定。 */
export type QuestionLevel = "core" | "deepen";

type QuestionSeed = {
  id: string;
  dimension: AssessmentDimension;
  prompt: string;
  type: AssessmentQuestionType;
  level: QuestionLevel;
  /** 缩短版（演示模式）是否可用。只有核心题与偏好题参与，保证演示足够短。 */
  inDemo: boolean;
  options: AssessmentOption[];
};

/** 维度展示名。 */
export const DIMENSION_LABELS: Record<AssessmentDimension, string> = {
  "research-literacy": "科研认知",
  "paper-literacy": "论文认知",
  "information-retrieval": "信息检索",
  "method-basics": "方法基础",
  "skill-basics": "技能基础",
  "action-experience": "行动经历",
  "interest-direction": "兴趣方向",
  "goal-and-time": "目标与时间",
};

const QUESTION_SEEDS: QuestionSeed[] = [
  /* ---------------- 科研认知 ---------------- */
  {
    id: "q-research-what",
    dimension: "research-literacy",
    prompt: "你觉得「科研」主要是在做什么？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "research-collect", label: "收集资料，整理成一份报告", score: 1 },
      { id: "research-experiment", label: "做实验、跑数据，得出结论", score: 2 },
      { id: "research-question", label: "提出一个问题，再用证据回答它", score: 3 },
    ],
  },
  {
    id: "q-research-hypothesis",
    dimension: "research-literacy",
    prompt: "「研究假设」这个词，对你来说…",
    type: "single",
    level: "deepen",
    inDemo: false,
    options: [
      { id: "hypothesis-heard", label: "听过，但说不清指什么", score: 1 },
      { id: "hypothesis-know", label: "大概知道它指什么", score: 2 },
      { id: "hypothesis-explain", label: "能用自己的话举例说明", score: 3 },
    ],
  },
  /* ---------------- 论文认知 ---------------- */
  {
    id: "q-paper-structure",
    dimension: "paper-literacy",
    prompt: "一篇学术论文通常由哪些部分组成？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "structure-part", label: "只知道有摘要和参考文献", score: 1 },
      { id: "structure-half", label: "大概说得出一半", score: 2 },
      { id: "structure-full", label: "能说出引言、方法、结果、讨论这些部分", score: 3 },
    ],
  },
  {
    id: "q-paper-venue",
    dimension: "paper-literacy",
    prompt: "期刊、会议、预印本的区别，你…",
    type: "single",
    level: "deepen",
    inDemo: false,
    options: [
      { id: "venue-heard", label: "听说过这些名字", score: 1 },
      { id: "venue-distinguish", label: "大致能区分", score: 2 },
      { id: "venue-role", label: "能说明它们在学术交流里各起什么作用", score: 3 },
    ],
  },
  /* ---------------- 信息检索 ---------------- */
  {
    id: "q-search-where",
    dimension: "information-retrieval",
    prompt: "如果要找一篇论文，你会怎么做？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "search-engine", label: "用普通搜索引擎搜关键词", score: 1 },
      /*
       * B7（PRD v3 §4.2）：外部测试想答"用 AI 找论文"，但三个选项是按
       * 「通用搜索 → 学术检索工具」的阶梯写的，AI 落在阶梯之外 ——
       * 用户只能选一个**不是自己做法**的选项。
       *
       * ⚠️ **分数给 1，绝不能给 null。** 直觉上想用 null 表示"不计分"，
       * 但那会把人标错：`scoreOfQuestion` 只把非 null 的分数塞进数组，
       * 维度分是 `average(questionScores)` —— 若该维度只问到这一题，数组为空、
       * 维度 level 变成 `unknown`，画像里会写"这方面你还没接触过"，
       * 而用户明明有做法。**比原来的问题更糟。**
       *
       * 给 1 有依据：这个维度测的是「会不会用**学术检索工具**、看不看得懂引用信息」，
       * 搜索引擎与 AI 问答同属**通用手段**，都还没进学术检索工具那一档。
       *
       * 单列一项、不并进"普通搜索引擎"，是为了让这种做法在数据里**可见** ——
       * 它正是 §4.3 第 6 条要查的事（选项是否覆盖"AI 时代的做法"）。
       */
      { id: "search-ai", label: "直接问 AI 工具帮我找", score: 1 },
      { id: "search-know-tool", label: "知道要用学术搜索工具，但还没实际用过", score: 2 },
      { id: "search-used-tool", label: "用过学术搜索工具，也看得懂引用信息", score: 3 },
    ],
  },
  {
    id: "q-search-judge",
    dimension: "information-retrieval",
    prompt: "判断一份资料可不可信，你会看什么？",
    type: "single",
    level: "deepen",
    inDemo: false,
    options: [
      { id: "judge-site", label: "看是不是官方或权威网站", score: 1 },
      { id: "judge-author", label: "会看作者、出处和发表时间", score: 2 },
      { id: "judge-cross", label: "会找到原始来源，再交叉核对一次", score: 3 },
    ],
  },
  /* ---------------- 方法基础 ---------------- */
  {
    id: "q-method-kinds",
    dimension: "method-basics",
    prompt: "常见的研究方法，你了解几种？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "method-one", label: "一种左右，比如问卷调查", score: 1 },
      { id: "method-few", label: "两三种", score: 2 },
      { id: "method-fit", label: "能说出几种方法各自适合什么情况", score: 3 },
    ],
  },
  {
    id: "q-method-design",
    dimension: "method-basics",
    prompt: "想研究「每天自习时长和考试成绩有没有关系」，你会怎么入手？",
    type: "single",
    level: "deepen",
    inDemo: false,
    options: [
      { id: "design-collect", label: "先收集一批人的自习时长和成绩，看有没有关系", score: 1 },
      { id: "design-measure", label: "先想清楚「时长」和「成绩」具体怎么量", score: 2 },
      { id: "design-confound", label: "还会考虑有没有别的因素在同时影响这两件事", score: 3 },
    ],
  },
  /* ---------------- 技能基础 ---------------- */
  {
    id: "q-skill-code",
    dimension: "skill-basics",
    prompt: "编程方面，你现在…",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "code-course", label: "上过课，跟着写过一点", score: 1 },
      { id: "code-homework", label: "能独立完成课程作业", score: 2 },
      { id: "code-project", label: "能独立做一个小项目", score: 3 },
    ],
  },
  {
    id: "q-skill-read",
    dimension: "skill-basics",
    prompt: "读英文文献，你现在…",
    type: "single",
    level: "deepen",
    inDemo: false,
    options: [
      { id: "read-translate", label: "借助翻译工具能看个大概", score: 1 },
      { id: "read-abstract", label: "能读懂摘要和图表", score: 2 },
      { id: "read-full", label: "能比较顺畅地读完整篇", score: 3 },
    ],
  },
  /* ---------------- 行动经历 ---------------- */
  {
    id: "q-exp-paper",
    dimension: "action-experience",
    prompt: "你完整读过一篇学术论文吗？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "exp-none", label: "还没有", score: 0 },
      { id: "exp-part", label: "读过一部分，比如摘要或其中几节", score: 1 },
      { id: "exp-one", label: "完整读过一两篇", score: 2 },
      { id: "exp-many", label: "完整读过三篇以上，还做过笔记", score: 3 },
    ],
  },
  {
    id: "q-exp-activity",
    dimension: "action-experience",
    prompt: "和科研有关的活动，你已经做到哪一档？（参加过多项就选最深的那一档）",
    type: "single",
    level: "deepen",
    inDemo: false,
    /*
     * ⚠️ **保持单选。** 原题干是「你参加过哪些？」，问的是复数、题型却是单选，
     * 于是"听过讲座 + 参加过竞赛"的人只能选一项，**最多的一段经历被丢掉、分数被低估**
     * （PRD v3 §4.1-A6，来自外部测试反馈）。
     *
     * 为什么不干脆改成 `type: "multi"`：`scoreOfQuestion` 对多选**取平均**
     * （见 `scoring.ts`），意味着选项选得越多分越低 ——
     * 竞赛(2) + 实验室(3) 平均 2.5，反而低于"只进过实验室"的 3 分。
     * 那会把"经历更丰富"判成"能力更弱"，比现在的措辞问题严重得多。
     * 真要改成多选，得先让能力类题目**取最高档而不是平均**。
     */
    options: [
      { id: "act-none", label: "还没参加过", score: 0 },
      { id: "act-talk", label: "听过讲座或学长学姐的分享", score: 1 },
      { id: "act-contest", label: "参加过竞赛或课程项目", score: 2 },
      { id: "act-lab", label: "进过实验室，跟着老师或学长做过事", score: 3 },
    ],
  },
  /* ---------------- 兴趣方向（不计分） ---------------- */
  {
    id: "q-interest",
    dimension: "interest-direction",
    prompt: "下面哪些方向你有点想了解？（可多选）",
    type: "multi",
    level: "core",
    inDemo: true,
    options: [
      { id: "it-ai", label: "人工智能", score: null },
      { id: "it-robotics", label: "机器人", score: null },
      { id: "it-data", label: "数据科学", score: null },
      { id: "it-bio", label: "生物医学", score: null },
      { id: "it-material", label: "材料与能源", score: null },
      { id: "it-hci", label: "人机交互", score: null },
      { id: "it-security", label: "网络安全", score: null },
    ],
  },
  /* ---------------- 目标与时间（不计分） ---------------- */
  {
    id: "q-goal",
    dimension: "goal-and-time",
    prompt: "现在你最想先解决哪一件事？",
    type: "single",
    level: "core",
    inDemo: false,
    options: [
      { id: "goal-understand", label: "先搞清科研到底是怎么回事", score: null },
      { id: "goal-direction", label: "找到自己真正感兴趣的方向", score: null },
      { id: "goal-read", label: "学会完整地读一篇论文", score: null },
      { id: "goal-lab", label: "准备好去联系实验室或老师", score: null },
    ],
  },
  {
    id: "q-time",
    dimension: "goal-and-time",
    prompt: "每周大概能拿出多少时间做这些事？",
    type: "single",
    level: "core",
    inDemo: true,
    options: [
      { id: "time-1-2", label: "1～2 小时", score: null },
      { id: "time-3-5", label: "3～5 小时", score: null },
      { id: "time-6-10", label: "6～10 小时", score: null },
      { id: "time-10-plus", label: "10 小时以上", score: null },
    ],
  },
];

/**
 * 时间选项 → 每周小时数（保守取下限那一端）。
 * 不放进契约：只有这一道题用得到，而且它是"规划参数"而不是"用户数据"。
 */
export const WEEKLY_HOURS_BY_OPTION: Record<string, number> = {
  "time-1-2": 2,
  "time-3-5": 4,
  "time-6-10": 8,
  "time-10-plus": 10,
};

/** 没选时间时的默认值：按最低档规划，宁可低估也不制造压力。 */
export const DEFAULT_WEEKLY_HOURS = 3;

function toQuestion(seed: QuestionSeed, order: number): AssessmentQuestion {
  return {
    id: seed.id,
    dimension: seed.dimension,
    prompt: seed.prompt,
    type: seed.type,
    order,
    options: seed.options,
    // 有「不计分」选项的题（兴趣、时间、目标）不给「不知道」按钮：
    // 它们本身不是认知题，追问"知不知道"没有意义。
    allowUnknown: seed.options.every((option) => option.score !== null),
    required: true,
  };
}

/** 全部题目（含深入题），顺序即种子顺序。题号从 1 开始（用 map 时别把索引直接当序号）。 */
export const ALL_QUESTIONS: AssessmentQuestion[] = QUESTION_SEEDS.map((seed, index) => toQuestion(seed, index + 1));

export const QUESTION_BY_ID: ReadonlyMap<string, AssessmentQuestion> = new Map(
  ALL_QUESTIONS.map((question) => [question.id, question]),
);

/** 题号 → 层级。选题逻辑需要它，但它不属于浏览器必须知道的契约。 */
export const QUESTION_LEVEL: Record<string, QuestionLevel> = Object.fromEntries(
  QUESTION_SEEDS.map((seed) => [seed.id, seed.level]),
);

/** 核心题（每个能力维度的必问题，加上兴趣/目标/时间）。 */
export const CORE_QUESTIONS: AssessmentQuestion[] = ALL_QUESTIONS.filter(
  (question) => QUESTION_LEVEL[question.id] === "core",
);

/** 深入题：只在对应核心题答得不错时才会被问到。 */
export const DEEPEN_QUESTIONS: AssessmentQuestion[] = ALL_QUESTIONS.filter(
  (question) => QUESTION_LEVEL[question.id] === "deepen",
);

/** 题号 → 是否参与演示（缩短版）。 */
const DEMO_QUESTION_IDS = new Set(QUESTION_SEEDS.filter((seed) => seed.inDemo).map((seed) => seed.id));

export function isAvailableInMode(questionId: string, mode: AssessmentMode): boolean {
  return mode === "demo" ? DEMO_QUESTION_IDS.has(questionId) : true;
}

function questionnaireOf(mode: AssessmentMode): AssessmentQuestionnaire {
  const seeds = QUESTION_SEEDS.filter((seed) => (mode === "demo" ? seed.inDemo : true));

  return {
    schemaVersion: SCHEMA_VERSION,
    id: mode === "demo" ? "questionnaire-demo-v1" : "questionnaire-full-v1",
    mode,
    // 实际题数由自适应逻辑决定，这里给的是上限估计（PRD §8.5 要求 3～5 分钟）。
    estimatedMinutes: mode === "demo" ? 2 : 4,
    questions: seeds.map((seed, index) => toQuestion(seed, index + 1)),
  };
}

export const FULL_QUESTIONNAIRE: AssessmentQuestionnaire = questionnaireOf("full");
export const DEMO_QUESTIONNAIRE: AssessmentQuestionnaire = questionnaireOf("demo");

export function getQuestionnaire(mode: AssessmentMode): AssessmentQuestionnaire {
  return mode === "demo" ? DEMO_QUESTIONNAIRE : FULL_QUESTIONNAIRE;
}

/**
 * 演示用的预设作答（PRD §18.2 的示例用户：大一、计算机、对 AI 与机器人有兴趣、
 * 编程刚起步、不会读论文、每周 3～5 小时）。
 *
 * ⚠️ 它是**明确的样例数据**：用它生成的画像与路线都必须带 `isDemo: true`。
 */
export const DEMO_ANSWERS: AssessmentAnswer[] = [
  { questionId: "q-research-what", optionIds: ["research-collect"], unknown: false },
  { questionId: "q-paper-structure", optionIds: ["structure-part"], unknown: false },
  { questionId: "q-search-where", optionIds: ["search-engine"], unknown: false },
  { questionId: "q-method-kinds", optionIds: ["method-one"], unknown: false },
  { questionId: "q-skill-code", optionIds: ["code-course"], unknown: false },
  { questionId: "q-exp-paper", optionIds: ["exp-none"], unknown: false },
  { questionId: "q-interest", optionIds: ["it-ai", "it-robotics", "it-data"], unknown: false },
  { questionId: "q-time", optionIds: ["time-3-5"], unknown: false },
];
