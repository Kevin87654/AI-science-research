import type { EntryRouteResponse } from "@/contracts";
import { toInterestTag } from "@/features/interest/directions";
import { parseEntryRouteRequest } from "@/features/roadmap/entry-route";
import { generateEntryRoute } from "@/server/ai/entry-route-planner";
import { jsonError, jsonOk, toErrorResponse } from "@/server/services/api-response";
import { readSession } from "@/server/services/identity";


/**
 * 「入门前置路线」生成接口。
 *
 * 输入一个兴趣方向 id（必须落在固定方向目录内），返回该方向的入门导览
 * （热点 / 实验 / 研究者 / 入门论文）。与问答一样调用付费模型，**必须带会话**。
 */
export async function handleEntryRoute(request: Request) {
  try {
    const resolved = await readSession(request.headers.get("cookie"));
    if (!resolved) {
      return jsonError("UNAUTHORIZED", "会话还没建立，请刷新页面后再试。");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("BAD_REQUEST", "请求体不是合法的 JSON。");
    }

    const directionId = parseEntryRouteRequest(body);
    if (!directionId || !toInterestTag(directionId)) {
      return jsonError("BAD_REQUEST", "方向不合法，请从固定方向目录里选择。");
    }

    const route = await generateEntryRoute(directionId);
    if (!route) {
      return jsonError("UPSTREAM_UNAVAILABLE", "AI 暂时不可用，请稍后再试。");
    }

    return jsonOk<EntryRouteResponse>({ route });
  } catch (error) {
    return toErrorResponse(error);
  }
}
