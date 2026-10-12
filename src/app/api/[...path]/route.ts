import { handlePing } from "@/server/api/handlers/ping";
import { handleSessionGet, handleSessionPost } from "@/server/api/handlers/session";
import { handleAssessmentNext } from "@/server/api/handlers/assessment";
import { handleProgressGet, handleProgressPost } from "@/server/api/handlers/progress";
import { handleQuestions } from "@/server/api/handlers/questions";
import { handleSparks } from "@/server/api/handlers/sparks";
import { handleEntryRoute } from "@/server/api/handlers/entry-route";
import { jsonError } from "@/server/services/api-response";

/**
 * 统一 API 入口（catch-all）。
 *
 * 为什么合并成这一个路由：Vercel 免费版（Hobby）对**每个 `/api` 下的 `route.ts` 文件
 * 各算一个 Serverless Function**，上限 12 个。原来拆成 7 个独立 route（ping/session/
 * assessment/next/progress/questions/sparks/entry-route），加上部署时的其它函数会撞上限。
 * 合并成 catch-all 后只占 1 个函数，URL 完全不变（前端零改动）。
 *
 * 各接口的真实逻辑仍在 `src/server/api/handlers/*`，这里只按路径分发。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { path } = await params;

  switch (path.join("/")) {
    case "ping":
      return handlePing();
    case "session":
      return handleSessionGet(request);
    case "progress":
      return handleProgressGet(request);
    default:
      return jsonError("NOT_FOUND", "接口不存在。");
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { path } = await params;

  switch (path.join("/")) {
    case "session":
      return handleSessionPost(request);
    case "assessment/next":
      return handleAssessmentNext(request);
    case "progress":
      return handleProgressPost(request);
    case "questions":
      return handleQuestions(request);
    case "sparks":
      return handleSparks(request);
    case "entry-route":
      return handleEntryRoute(request);
    default:
      return jsonError("NOT_FOUND", "接口不存在。");
  }
}
