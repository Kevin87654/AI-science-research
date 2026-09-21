import "server-only";

import type { HealthStatus } from "@/contracts/api";
import { isAiConfigured } from "@/server/ai/config";
import { usingPersistentStore } from "@/server/repositories";

/**
 * 仅检查应用存活与已接入的集成；不发起付费调用，也不做真实读写。
 *
 * `database` / `ai` 都只表示**配置是否到位**，不表示上游此刻可达 ——
 * 真实可达性要靠一次实际读写 / 实际调用验证（`scripts/verify/**` 与验收脚本）。
 */
export function getHealthStatus(): HealthStatus {
  return {
    application: "ready",
    integrations: {
      database: usingPersistentStore ? "connected" : "not_connected",
      // 注意：这里必须走 config 而不是 codebuddy 适配器 —— 后者会加载 SDK 并解析 CLI 路径，
      // 让一个"自检"接口去付这个代价没有必要。
      ai: isAiConfigured() ? "connected" : "not_connected",
    },
  };
}
