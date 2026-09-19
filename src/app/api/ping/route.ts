import type { ApiResponse, HealthStatus } from "@/contracts/api";
import { getHealthStatus } from "@/server/services/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, data: getHealthStatus() } satisfies ApiResponse<HealthStatus>,
    { headers: { "Cache-Control": "no-store" } },
  );
}
