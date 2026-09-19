import "server-only";
import type { HealthStatus } from "@/contracts/api";

/** 仅检查应用存活；不声称数据库或模型已经连通，也不触发付费调用。 */
export function getHealthStatus(): HealthStatus {
  return {
    application: "ready",
    integrations: { database: "not_connected", ai: "not_connected" },
  };
}
