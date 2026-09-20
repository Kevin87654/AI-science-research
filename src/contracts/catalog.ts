/**
 * 校内资源目录契约（C 模块已交付字段，原样保留）。
 *
 * 对应 PRD §13「实验室与导师公开资料」。
 * 注意几条**产品红线**已经体现在字段设计里：
 * - `recruitment.currentAvailability` 固定为 `unknown` —— 不提供任何名额推测；
 * - `editorial` 与 `pendingConfirmation` 分开存放「产品编辑建议」与「需要用户自行核实的问题」；
 * - `isDemo` 用于明确标识演示数据，演示数据不得混入真实记录。
 */
import type { IsoDate, VersionedPayload } from "./common";
import type { Source } from "./source";

export interface Teacher {
  id: string;
  type: "mentor";
  name: string;
  school: string;
  college: string;
  /** 所属研究中心 / 实验室。 */
  researchUnit: string;
  title: string | null;
  directions: string[];
  summary: string;
  /** 公开邮箱；没有公开邮箱时为 `null`，不要留占位文本。 */
  publicEmail: string | null;
  source: Source;
  recruitment: {
    /** 官方页面里的原话概括。 */
    status: string;
    note: string;
    /** 永远为 `unknown`：不展示名额推断。 */
    currentAvailability: "unknown";
  };
  representativeWorks: Array<{
    title: string;
    year: number;
    venue: string;
    sourceId: string;
    verification: "listed-on-profile";
    note: string;
  }>;
  /** 产品编辑层：建议专业与下一步建议，**不是老师的招生条件**。 */
  editorial: {
    suggestedMajors: string[];
    note: string;
    nextSteps: string[];
  };
  /** 联系前建议用户自行核实的问题。 */
  pendingConfirmation: string[];
  isDemo: boolean;
}

export interface Catalog extends VersionedPayload {
  /** 本次核验日期，作为整批资料的基准。 */
  checkedAt: IsoDate;
  /** 覆盖范围说明，必须写清"不是全校目录"这类限制。 */
  scope: string;
  notice: string;
  teachers: Teacher[];
}

/** 检索条件。所有字段可选，`undefined` = 不限制。 */
export interface SearchOptions {
  query?: string;
  direction?: string;
  college?: string;
  undergraduateOnly?: boolean;
  /** 由画像的兴趣标签提供（B → C 的联动入口）。 */
  interests?: string[];
}

/** 检索命中结果。`reasons` 必须能解释「为什么推荐」。 */
export interface Match {
  teacher: Teacher;
  matchedTags: string[];
  reasons: string[];
  /** 匹配免责说明，例如"检索不到不等于全校没有"。 */
  disclaimer: string;
}
