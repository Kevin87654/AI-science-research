import type { ApiResponse, HealthStatus } from "@/contracts/api";
import { getHealthStatus } from "@/server/services/health";


export function handlePing() {
  return Response.json(
    { ok: true, data: getHealthStatus() } satisfies ApiResponse<HealthStatus>,
    { headers: { "Cache-Control": "no-store" } },
  );
}
