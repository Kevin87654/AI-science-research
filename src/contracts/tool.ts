/**
 * 科研工具箱契约 —— 收录搞科研时常用的外部网站链接。
 *
 * 为什么单独建一份而不是塞进 `catalog.ts`（教师目录）：教师是「可核验的校内资料」，
 * 工具箱是「外部站点导航」，两者的可信度语义不同——工具链接**不宣称背书**，
 * 只做「这是什么、怎么用、免费与否」的客观说明，因此字段也刻意简单。
 *
 * 与产品红线的关系：这些链接本身是公开资源，但**不承诺链接永远有效**，
 * `note` 里会写清「部分内容需订阅」这类边界；工具列表不是「全部」，`scope` 会说明。
 */
import type { VersionedPayload } from "./common";

/** 工具分类。 */
export type ToolCategory = "paper-library" | "learning" | "frontier-news";

/** 访问方式。 */
export type ToolAccess = "free" | "freemium" | "paid";

/** 界面语言。 */
export type ToolLanguage = "zh" | "en" | "both";

export interface ResearchTool {
  id: string;
  name: string;
  url: string;
  category: ToolCategory;
  /** 一句话说明它是什么、能用来做什么。 */
  description: string;
  access: ToolAccess;
  language: ToolLanguage;
  /** 标签，如「论文检索」「AI 前沿」。 */
  tags: string[];
  /** 边界说明，例如「全文需机构订阅」「未同行评审」。 */
  note?: string;
}

export interface ToolDirectory extends VersionedPayload {
  /** 覆盖范围说明，写清「这是常用站点导航，不是全部」。 */
  scope: string;
  notice: string;
  tools: ResearchTool[];
}
