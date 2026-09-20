/**
 * 匿名身份契约（A 负责）。
 *
 * 方案 A：服务端生成随机 Token → 只存 SHA-256 → 通过 HttpOnly Cookie 下发。
 * **不使用 CloudBase Auth**，也不采集真实姓名、学号、手机号（PRD §7.3）。
 *
 * 注意：`userId` 是服务端产物。任何业务接口收到请求体里的 `userId` 都必须忽略，
 * 以服务端从 Cookie 解析出的身份为准。
 */
import type { IsoDateTime } from "./common";

/**
 * `anonymous` = 普通匿名用户；`demo` = 明确标识的演示账号。
 * 演示数据用该标记与真实用户隔离（免费环境只有一个数据库，没有独立测试库）。
 */
export type AccountType = "anonymous" | "demo";

export interface Session {
  /** 服务端生成的用户标识。 */
  userId: string;
  /** 匿名会话，不要求注册。 */
  kind: "anonymous";
  accountType: AccountType;
  createdAt: IsoDateTime;
}

export interface SessionResponse {
  session: Session;
  /** `null` = 过期时间由 Cookie 的 Max-Age 决定，不额外返回。 */
  expiresAt: IsoDateTime | null;
}
