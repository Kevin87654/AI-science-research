import "server-only";

import type { HealthStatus } from "@/contracts/api";
import { usingPersistentStore } from "@/server/repositories";

/**
 * 仅检查应用存活与已接入的集成；不发起付费调用，也不做真实读写。
 *
 * `database` 只表示**配置是否到位**（两个 `SERVER_CLOUDBASE_*` 变量是否都有），
 * 不表示数据库此刻可达 —— 真实可达性要靠一次实际读写验证（`pnpm test` 与验收脚本）。
 */
export function getHealthStatus(): HealthStatus {
  return {
    application: "ready",
    integrations: {
      database: usingPersistentStore ? "connected" : "not_connected",
      ai: "not_connected",
    },
  };
}
