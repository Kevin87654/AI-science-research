import "server-only";

/**
 * 「入门前置路线」生成（B 负责）—— 兴趣方向 → 领域入门导览。
 *
 * 职责与 `spark-analyzer.ts` 一致：组提示词 → 调模型 → 校验 → 返回或 `null`。
 * 方向的合法性在这里由 `toInterestTag` 兜底 —— 服务端应已挡掉非法方向，
 * 这里再挡一道只是"不把脏 id 交给模型去展开"。
 *
 * ⚠️ 内容性质：热点 / 实验 / 研究者 / 入门论文是**开放知识**，我们没有人手核验过
 * 的来源库可引用，所以这份导览是 AI 生成、**未经人工核验**的 —— 界面必须如实标注，
 * 不得与核验过的教师资料 / 来源混为一谈（契约红线，见 `contracts/spark.ts`）。
 */
import type { InterestEntryRoute, InterestTag } from "@/contracts";
import { INTEREST_DIRECTION_DESCRIPTIONS, toInterestTag } from "@/features/interest/directions";
import { parseEntryRoute } from "@/features/roadmap/entry-route";

import { askText, isAiConfigured } from "./codebuddy";
import { resolveAiTimeoutMs } from "./config";

/** 与问答 / 奇思妙想同量级的生成任务，沿用 120 秒下限。 */
const TIMEOUT_FLOOR_MS = 120_000;

function resolveTimeoutMs(): number {
  return Math.max(resolveAiTimeoutMs(), TIMEOUT_FLOOR_MS);
}

function buildPrompt(direction: InterestTag): string {
  const description = INTEREST_DIRECTION_DESCRIPTIONS[direction.id] ?? direction.label;

  return [
    "你是一个科研入门向导。现在要为一个对「" + direction.label + "」感兴趣的大学生写一份「入门前置路线」：",
    "在他动手做科研之前，先帮他建立对这个方向的整体认知。目标读者是还没入门的本科生，",
    "内容要真实、具体、点到为止，不要堆术语。",
    "",
    "【这个方向】",
    direction.label + "：" + description,
    "",
    "【要输出的四个板块】每板块固定 2 条，不要多：",
    "1. overview：两句话以内，说清这个方向在研究什么、为什么值得关注。",
    "2. hotspots：2 个当前领域内的热点话题，title 是话题名，why 一句话（不超过 30 字）。",
    "3. milestones：2 个著名的实验 / 里程碑成果，title 建议带年份，why 一句话（不超过 30 字）。",
    "4. researchers：2 位值得了解的研究者，title 是姓名，why 一句话说明他的贡献（不超过 30 字）。",
    "5. entryPapers：2 篇入门级论文或经典材料，title 是论文名，why 一句话（不超过 30 字）。",
    "",
    "【硬要求】",
    "- 内容要真实、具体，宁可少也不要编造人名或论文名。",
    "- 面向新手，解释要平实，避免堆砌术语。",
    "- 只输出一个 JSON 对象，不要代码块标记、不要任何解释：",
    '{"overview":"...","hotspots":[{"title":"...","why":"..."}],"milestones":[...],"researchers":[...],"entryPapers":[...]}',
  ].join("\n");
}

/**
 * 为某个方向生成入门前置路线。返回 `null` 表示失败或输出不合法，由调用方兜底。
 */
export async function generateEntryRoute(directionId: string): Promise<InterestEntryRoute | null> {
  const direction = toInterestTag(directionId);
  if (!direction) {
    console.error(`[ai] 入门前置路线跳过：非法方向 id=${directionId}`);
    return null;
  }

  if (!isAiConfigured()) {
    console.error("[ai] 入门前置路线跳过：未配置密钥");
    return null;
  }

  const result = await askText(buildPrompt(direction), {
    timeoutMs: resolveTimeoutMs(),
    // 内容生成类任务用 fast-model：default（auto）会间歇「只吐 thinking、不吐正文」
    // 导致 `code=empty`（见 codebuddy.ts 文件头诊断），fast-model 稳定且快得多。
    model: "fast-model",
  });
  if (!result.ok) {
    console.error(`[ai] 入门前置路线降级：code=${result.code}`);
    return null;
  }

  const route = parseEntryRoute({
    modelText: result.text,
    direction,
    id: `entry-route-${directionId}`,
    generatedAt: new Date().toISOString(),
  });
  if (!route) {
    console.error("[ai] 入门前置路线降级：输出未通过校验");
    if (process.env.SERVER_AI_DEBUG === "1") {
      console.error(`[ai] 模型输出原文 len=${result.text.length} text=${JSON.stringify(result.text.slice(0, 800))}`);
    }
    return null;
  }

  console.error(
    `[ai] 入门前置路线完成 耗时=${result.durationMs}ms 方向=${direction.label} 条目=${route.hotspots.length + route.milestones.length + route.researchers.length + route.entryPapers.length}`,
  );
  return route;
}
