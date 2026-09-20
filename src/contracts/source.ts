/**
 * 引用来源契约（C 模块已交付字段，原样保留）。
 *
 * 设计要点：
 * - `checkedAt` 是**我们阅读页面的日期**，不是学校更新内容的日期；
 * - `pageUpdatedAt` 未知时必须是 `null`，**不得用 `checkedAt` 顶替**；
 * - `supportedFields` 说明这条来源能支撑哪些字段，用于"哪些结论有据可查"。
 */
import type { IsoDate, SourceVerification } from "./common";

export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  /** YYYY-MM-DD，我们阅读该页面的日期。 */
  checkedAt: IsoDate;
  /** 页面自身的更新日期；`null` = 未知，未知时不要填 `checkedAt`。 */
  pageUpdatedAt: IsoDate | null;
  verification: SourceVerification;
  /** 这条来源实际证明了什么，一到两句。 */
  evidenceSummary: string;
  /** 可选：该来源能支撑的目标字段名列表。 */
  supportedFields?: string[];
}
