/** HTTP 契约只包含可序列化数据，浏览器与服务端共用。 */

/**
 * 业务错误码。**不要透传数据库或网关的错误码**：
 * 网关返回的 `message` 是数据库原文，会带出表名与列名（见《数据库接入探针记录》§5）。
 *
 * 出现真实场景需要细分时，在这里加枚举值，并在 `src/contracts/README.md` 的表里补一行。
 */
export type ApiErrorCode =
  /** 入参不合法：必答题未完成、类型不符、缺少必需字段。 */
  | "BAD_REQUEST"
  /** 没有会话，或会话已失效。 */
  | "UNAUTHORIZED"
  /** 会话有效，但目标记录不属于本人。 */
  | "FORBIDDEN"
  /** 目标记录不存在。 */
  | "NOT_FOUND"
  /** 冲突：重复提交、版本不符。 */
  | "CONFLICT"
  /** 数据访问超过 8 秒上限。 */
  | "TIMEOUT"
  /** 上游不可用，可重试。 */
  | "UPSTREAM_UNAVAILABLE"
  /** 其他未预期错误。对外的 message 必须是中性文案。 */
  | "INTERNAL";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; requestId: string } };

export type HealthStatus = {
  application: "ready";
  integrations: {
    /**
     * `connected` 只表示**服务端配置已到位**（两个 `SERVER_CLOUDBASE_*` 变量都存在），
     * 不表示数据库此刻可达 —— 真实可达性要用一次实际读写验证。
     */
    database: "connected" | "not_connected";
    ai: "not_connected";
  };
};
