/**
 * 「奇思妙想」与「入门前置路线」契约 —— 第二轮两个优化共用的类型（B 负责）。
 *
 * ## 与既有契约的分工
 *
 * - `assessment.ts` 的 `InterestProbeResult` 是测评开头的**启发式探测**（两题）；
 * - 这里的 `SparkAnalysis` 是「奇思妙想」模块**自由文本分析**的产物；
 * - 两者都落到同一个 `InterestTag`（见 `profile.ts`），并一起成为「兴趣方向」，
 *   喂给画像、路线前置、刊物科普与论文推荐。
 *
 * ## 红线
 *
 * 1. **AI 生成必须显式可识别**：`SparkAnalysis` / `InterestEntryRoute` 由模型产出，
 *    界面一律要标「AI 生成、未经人工核验」，不得与核验过的资料混为一谈。
 * 2. **方向 id 只认固定目录**：`InterestTag.id` 必须落在 `interest/directions.ts`
 *    的 `INTEREST_DIRECTIONS` 里，模型不能凭空造新方向 —— 解析层会丢弃非法 id。
 */
import type { IsoDateTime, VersionedPayload } from "./common";
import type { InterestTag } from "./profile";

/* ------------------------------------------------------------------ *
 * 奇思妙想：自由文本 → 亮点 + 兴趣方向
 * ------------------------------------------------------------------ */

/** 一次「奇思妙想」输入的分析结果。 */
export interface SparkAnalysis extends VersionedPayload {
  id: string;
  /** 用户输入原文（已截断到长度上限）。 */
  text: string;
  /** AI 发现的亮点（闪光点 / 长处 / 值得注意的地方），1～5 条。 */
  highlights: string[];
  /** 从输入推断出的兴趣方向标签。 */
  interests: InterestTag[];
  /** 为什么这样判断，可解释，会展示给用户。 */
  rationale: string;
  /** 给用户的一句回应 / 鼓励，可为空。 */
  response: string | null;
  generatedAt: IsoDateTime;
}

/** 一条「奇思妙想」记录：输入原文 + 分析结果。 */
export interface SparkEntry extends VersionedPayload {
  id: string;
  text: string;
  /** 分析失败 / 尚未分析时为 `null`。 */
  analysis: SparkAnalysis | null;
  createdAt: IsoDateTime;
}

/** 提交分析请求。身份由服务端从会话确认，不在此处。 */
export interface SparkAnalyzeRequest {
  text: string;
}

export interface SparkAnalyzeResponse {
  analysis: SparkAnalysis;
}

/* ------------------------------------------------------------------ *
 * 入门前置路线：兴趣方向 → 领域入门导览
 * ------------------------------------------------------------------ */

/** 前置路线里的一条条目：标题 + 为什么值得了解。 */
export interface InterestEntryItem {
  /** 标题，例如热点话题名、里程碑名、研究者姓名、论文名。 */
  title: string;
  /** 为什么值得了解，一两句具体说明。 */
  why: string;
}

/**
 * 兴趣入门前置路线：在完成现有学习路线前，先对某个方向建立整体认知。
 *
 * 由 AI 生成（热点 / 实验 / 研究者 / 入门论文是开放知识，我们并无人工核验过的
 * 来源库可引用），因此**不参与任务进度**、**不挂核验来源**，只做「入门导览」。
 */
export interface InterestEntryRoute extends VersionedPayload {
  id: string;
  /** 基于哪个兴趣方向生成。 */
  direction: InterestTag;
  /** 这个方向在做什么的一段介绍。 */
  overview: string;
  /** 领域内的热点话题。 */
  hotspots: InterestEntryItem[];
  /** 著名的实验 / 里程碑成果。 */
  milestones: InterestEntryItem[];
  /** 值得了解的研究者。 */
  researchers: InterestEntryItem[];
  /** 入门级的论文 / 材料。 */
  entryPapers: InterestEntryItem[];
  generatedAt: IsoDateTime;
}

export interface EntryRouteRequest {
  directionId: string;
}

export interface EntryRouteResponse {
  route: InterestEntryRoute;
}
