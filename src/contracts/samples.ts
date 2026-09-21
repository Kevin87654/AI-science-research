/**
 * 最小样例 —— 第一条可验收流程的完整数据示例。
 *
 * 用途：让三人对同一份数据达成一致，**不用先读懂所有类型定义**。
 * 它同时是被 `tsc --noEmit` 检查的真实代码（不是手写的说明性 JSON），
 * 所以**类型改了而样例没改会直接编译失败**，不会出现"文档和类型不一致"。
 *
 * 覆盖范围（对齐《工程起步与分工路线》要求的五项）：
 *   测评提交 → 画像结果 → 路线与任务 → 任务进度 → 资料与引用
 *
 * ⚠️ 这是**明确标识的演示数据**（各处 `isDemo: true`），不得混入真实用户记录。
 * 里面的教师与来源片段是结构示例，真实内容以 C 模块迁移进主工程的目录为准。
 */
import type { AssessmentQuestionnaire, AssessmentSubmission } from "./assessment";
import type { Teacher } from "./catalog";
import type { Session } from "./identity";
import type { Answer } from "./knowledge";
import type { Profile } from "./profile";
import type { ProgressSnapshot } from "./progress";
import type { Roadmap } from "./roadmap";
import type { Source } from "./source";

const SCHEMA_VERSION = "1.0.0";
const CHECKED_AT = "2026-09-20";
const NOW = "2026-09-20T16:30:00+08:00";
const USER_ID = "demo-user-0001";

/** ① 匿名会话：服务端写入 kind / accountType / userId。 */
export const sampleSession: Session = {
  userId: USER_ID,
  kind: "anonymous",
  accountType: "demo",
  createdAt: NOW,
};

/** ② 测评问卷（演示模式：题量减少，评分逻辑不变）。 */
export const sampleQuestionnaire: AssessmentQuestionnaire = {
  schemaVersion: SCHEMA_VERSION,
  id: "questionnaire-v1",
  mode: "demo",
  estimatedMinutes: 1,
  questions: [
    {
      id: "q-research-basic",
      dimension: "research-literacy",
      prompt: "你觉得自己了解「什么是研究问题」吗？",
      type: "single",
      order: 1,
      options: [
        { id: "a-yes", label: "能举例说明", score: 2 },
        { id: "a-partly", label: "听过但说不清", score: 1 },
      ],
      allowUnknown: true,
      required: true,
    },
  ],
};

/** ③ 测评提交：**不含 userId**，身份从会话取。 */
export const sampleSubmission: AssessmentSubmission = {
  questionnaireId: "questionnaire-v1",
  mode: "demo",
  answers: [{ questionId: "q-research-basic", optionIds: ["a-partly"], unknown: false }],
  submittedAt: NOW,
};

/** ④ 画像结果：`interests` 是 B → C 的联动入口。 */
export const sampleProfile: Profile = {
  schemaVersion: SCHEMA_VERSION,
  id: "profile-0001",
  userId: USER_ID,
  stage: { code: "research-observation", label: "科研观察期" },
  summary: "你已经开始关注科研，但还没有把兴趣落到具体的读或做的动作上。",
  strengths: ["愿意主动了解科研是什么"],
  gaps: ["还没有完整读过一篇论文", "不熟悉学术搜索工具"],
  interests: [
    { id: "it-data-mining", label: "数据挖掘", source: "user-input" },
    { id: "it-recommender", label: "推荐系统", source: "derived" },
  ],
  priorityActions: [
    {
      id: "pa-read-abstract",
      title: "打开一位老师的主页，读一篇成果的摘要",
      rationale: "你选的方向里有现成公开成果，先建立「看得懂一点」的经验。",
      linkedTaskId: "task-read-abstract",
    },
  ],
  basis: "依据「科研认知」选了『听过但说不清』、兴趣方向选了『数据挖掘』推导。",
  sourceSubmissionId: "submission-0001",
  generatedAt: NOW,
  isDemo: true,
};

/** ⑤ 学习路线与任务：任务"怎么做"在这里，"做到哪一步"在进度里。 */
export const sampleRoadmap: Roadmap = {
  schemaVersion: SCHEMA_VERSION,
  id: "roadmap-0001",
  userId: USER_ID,
  profileId: "profile-0001",
  title: "两个月认识科研的第一步",
  goal: "完成 3 个具体动作，知道自己要不要继续做科研。",
  suggestedWeeks: 8,
  stages: [
    {
      id: "stage-explore",
      order: 1,
      title: "先看真实的东西",
      description: "用真实论文和老师主页建立直觉，不急着学方法。",
      taskIds: ["task-read-abstract", "task-search-tool"],
    },
  ],
  tasks: [
    {
      id: "task-read-abstract",
      stageId: "stage-explore",
      order: 1,
      title: "读一篇入门综述的摘要",
      description: "在老师主页上选一篇成果，只读标题与摘要。",
      estimatedMinutes: 30,
      completionCriteria: ["写下 2 个没看懂的关键词", "记录这篇文章解决什么问题"],
      resourceIds: ["src-teacher-home"],
      skippable: false,
    },
    {
      id: "task-search-tool",
      stageId: "stage-explore",
      order: 2,
      title: "用一次学术搜索工具",
      description: "用关键词搜一次，把结果列表截图或记下前 3 条标题。",
      estimatedMinutes: 20,
      completionCriteria: ["记录用过的工具名", "列出 3 条结果标题"],
      resourceIds: [],
      skippable: true,
    },
  ],
  generatedAt: NOW,
  isDemo: true,
};

/** ⑥ 任务进度：本轮唯一要求落库的数据，读写都必须带服务端确认的 userId。 */
export const sampleProgress: ProgressSnapshot = {
  schemaVersion: SCHEMA_VERSION,
  userId: USER_ID,
  roadmapId: "roadmap-0001",
  items: [
    { taskId: "task-read-abstract", status: "completed", note: null, updatedAt: NOW },
    { taskId: "task-search-tool", status: "in-progress", note: "工具还没选好", updatedAt: NOW },
  ],
  updatedAt: NOW,
};

/** ⑦ 资料与引用：每条事实都能追到一条来源。 */
export const sampleSource: Source = {
  id: "src-teacher-home",
  title: "示例教师｜深圳大学某研究中心",
  url: "https://example.szu.edu.cn/teacher/example",
  publisher: "深圳大学",
  checkedAt: CHECKED_AT,
  pageUpdatedAt: null,
  verification: "official-page-read",
  evidenceSummary: "页面列出研究方向与该方向的公开成果。",
  supportedFields: ["name", "college", "directions", "summary"],
};

export const sampleTeacher: Teacher = {
  id: "szu-cs-example",
  type: "mentor",
  name: "示例教师",
  school: "深圳大学",
  college: "计算机与软件学院",
  researchUnit: "某研究中心",
  title: null,
  directions: ["数据挖掘", "推荐系统"],
  summary: "示例简介，用于演示字段结构，不代表真实公开资料。",
  publicEmail: null,
  source: sampleSource,
  recruitment: {
    status: "示例状态",
    note: "示例说明；本科生参与情况未确认。",
    currentAvailability: "unknown",
  },
  representativeWorks: [
    {
      title: "示例成果",
      year: 2024,
      venue: "示例会议",
      sourceId: "src-teacher-home",
      verification: "listed-on-profile",
      note: "示例条目。",
    },
  ],
  editorial: {
    suggestedMajors: ["计算机科学与技术"],
    note: "专业标签是产品编辑建议，不是老师的招生条件。",
    nextSteps: ["打开官方主页，写下两个想了解的研究关键词。"],
  },
  pendingConfirmation: ["是否接受大一学生参与", "目前是否有名额"],
  isDemo: true,
};

/** ⑧ 问答回答：`status` 表达证据覆盖程度，不是模型置信度。 */
export const sampleAnswer: Answer = {
  mode: "directory",
  status: "limited",
  heading: "先看方向，再谈名额",
  answer: "示例中心有老师做推荐系统方向。当前资料只能确认研究方向，名额情况一律待确认。",
  actions: ["打开官方目录，记录两位与你兴趣相关的老师。"],
  citations: [sampleSource],
  teacherIds: ["szu-cs-example"],
  limitation: "本次样本只覆盖一个研究中心，检索不到不代表全校没有。",
  provenance: "规则检索：关键词命中主题标签 + 校内资源目录。",
};

/** 整条流程打包导出，便于一次性引用与对照。 */
export const minimalFlow = {
  session: sampleSession,
  questionnaire: sampleQuestionnaire,
  submission: sampleSubmission,
  profile: sampleProfile,
  roadmap: sampleRoadmap,
  progress: sampleProgress,
  source: sampleSource,
  teacher: sampleTeacher,
  answer: sampleAnswer,
} as const;
