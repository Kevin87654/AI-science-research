/**
 * 知识与问答契约（C 模块已交付字段，原样保留）。
 *
 * 对应 PRD §12。三条约束已经体现在字段里：
 * - `Answer.status` 表达的是**证据覆盖程度**，不是模型置信度；
 * - `limitation` / `provenance` 必须显式说明「结论边界」与「依据是什么」；
 * - `sourceIds` 只允许引用 `Knowledge.sources` 中真实存在的 id。
 */
import type { IsoDate, VersionedPayload } from "./common";
import type { Source } from "./source";

export interface Faq {
  id: string;
  question: string;
  /** 命中该 FAQ 的关键词。规则问答用，接入模型后可作召回提示。 */
  triggers: string[];
  category: string;
  answer: string;
  /** 回答里给出的可执行下一步。 */
  actions: string[];
  /** 引用 `Knowledge.sources` 里的 id。 */
  sourceIds: string[];
  /** 这条回答的适用边界或免责说明。 */
  limit: string;
  checkedAt: IsoDate;
  /** true = 产品编辑内容，不是官方原文。 */
  editorial: boolean;
}

export interface Knowledge extends VersionedPayload {
  /** 当前只实现规则问答；接入模型后新增枚举值，不改变含义。 */
  mode: "curated-rules";
  sources: Source[];
  faqs: Faq[];
}

export interface Answer {
  /** `curated` = 命中策展内容；`directory` = 命中校内资源目录；`fallback` = 未能确认。 */
  mode: "curated" | "directory" | "fallback";
  /** 证据覆盖程度，**不是**模型置信度。 */
  status: "supported" | "limited" | "unknown";
  heading: string;
  answer: string;
  /** 可执行下一步；可直接作为「加入路线」的候选。 */
  actions: string[];
  citations: Source[];
  /** 回答涉及的校内资源 id。 */
  teacherIds: string[];
  /** 无法确认时必须说明限制，不得留空。 */
  limitation: string;
  /** 这条回答是怎么产生的（规则命中 / 目录检索 / 降级）。 */
  provenance: string;
}

/**
 * 问答请求。**不含 `userId`**（铁律 1）：身份只能由服务端从会话解析。
 */
export interface QuestionRequest {
  question: string;
}

/**
 * 一条问答结果，外加「谁给出的」。
 *
 * 为什么单列 `decidedBy` 而不复用 `Answer.provenance`：`provenance` 是**给人读的散文**，
 * 措辞随时会改；而界面上的「AI 回答 / 规则回答」角标需要一个不会随文案漂移的取值。
 * 写法与 B 的 `AssessmentStep.decidedBy` 保持一致。
 *
 * 产品红线：**模型给出的回答必须与规则回答在界面上可区分**，
 * 不能让用户误以为一句模型生成的话也是"已核验资料"。
 */
export interface QuestionResult {
  answer: Answer;
  decidedBy: "rules" | "ai";
}
