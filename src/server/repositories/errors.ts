/**
 * 数据访问层的错误类型。
 *
 * 只表达"数据层发生了什么"，**不带任何数据库原文**。
 * 客户端看到的文案与状态码由 `src/server/services/api-response.ts` 统一映射 ——
 * 网关返回的 `message` 是数据库原文，会带出表名与列名，不能直传（见《数据库接入探针记录》§5）。
 */
export type RepositoryErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}
