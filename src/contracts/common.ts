/**
 * 契约层通用类型。
 *
 * 这一层只放**可序列化**的基础别名与元信息：不依赖任何运行时依赖，
 * 浏览器与服务端都能安全引用（ESLint 限制 `src/contracts/**` 不得导入 `@/server`）。
 *
 * 字段命名沿用 C 模块已交付数据中的写法，避免迁移时两套名字并存。
 */

/** ISO 8601 日期，形如 `2026-09-20`。用于「核验日期」这类不需要时刻的字段。 */
export type IsoDate = string;

/** ISO 8601 时间戳，带时区偏移，形如 `2026-09-20T15:59:38.464203+08:00`。 */
export type IsoDateTime = string;

/** 契约版本号，形如 `1.0.0`。字段增删改时递增，便于识别旧数据。 */
export type SchemaVersion = string;

/** 所有带版本号的载荷都应显式声明它。 */
export interface VersionedPayload {
  schemaVersion: SchemaVersion;
}

/**
 * 数据来源性质。**不用来表达"可信度高低"**，只说明这条事实是怎么被确认的。
 */
export type SourceVerification =
  /** 已阅读官方页面正文。 */
  | "official-page-read"
  /** 仅来自官方站内检索结果，未进正文。 */
  | "official-search-index";
