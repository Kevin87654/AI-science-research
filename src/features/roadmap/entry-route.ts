/**
 * 「入门前置路线」AI 输出的解析与校验（B 负责）—— 纯函数，可脱离网络单测。
 *
 * 与 `spark/analyze.ts` 同一套纪律：模型只产出内容，结构合法性在这里判定；
 * 四个板块（热点 / 里程碑 / 研究者 / 入门论文）各自解析、非法项丢弃、超长截断。
 *
 * 成立门槛：四个板块合计至少 2 个条目，否则「入门导览」空无一物，
 * 宁可不给也不放一个空壳。
 */
import type { InterestEntryItem, InterestEntryRoute, InterestTag } from "@/contracts";
import { clipText, parseJsonObject } from "../spark/analyze.ts";

const SCHEMA_VERSION = "1.0.0";

const MAX_ITEMS_PER_SECTION = 4;
const MAX_OVERVIEW = 220;
const MAX_ITEM_TITLE = 90;
const MAX_ITEM_WHY = 220;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 入门前置路线接口的入参校验：返回方向 id 或 `null`。
 * 是否真的是一个合法方向，由调用方用 `toInterestTag` 再判一次。
 */
export function parseEntryRouteRequest(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const { directionId } = body;
  if (typeof directionId !== "string") return null;

  const trimmed = directionId.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;

  return trimmed;
}

function parseItems(value: unknown): InterestEntryItem[] {
  if (!Array.isArray(value)) return [];

  const items: InterestEntryItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;

    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (title.length === 0) continue;

    const why = typeof record.why === "string" ? record.why.trim() : "";
    items.push({ title: clipText(title, MAX_ITEM_TITLE), why: clipText(why, MAX_ITEM_WHY) });

    if (items.length >= MAX_ITEMS_PER_SECTION) break;
  }
  return items;
}

/**
 * 把模型的原始文本解析成 `InterestEntryRoute`。
 *
 * `direction` 由调用方（服务端）从固定目录还原并传入，**不采信模型返回的方向** ——
 * 方向是谁决定的必须可控可解释，不能让模型自说自话换方向。
 * 返回 `null` 表示输出不成立，调用方兜底。
 */
export function parseEntryRoute(input: {
  modelText: string;
  direction: InterestTag;
  id: string;
  generatedAt: string;
}): InterestEntryRoute | null {
  const parsed = parseJsonObject(input.modelText);
  if (!parsed) return null;

  const overview =
    typeof parsed.overview === "string" ? clipText(parsed.overview, MAX_OVERVIEW) : "";

  const hotspots = parseItems(parsed.hotspots);
  const milestones = parseItems(parsed.milestones);
  const researchers = parseItems(parsed.researchers);
  const entryPapers = parseItems(parsed.entryPapers);

  const total = hotspots.length + milestones.length + researchers.length + entryPapers.length;
  if (total < 2) return null;

  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    direction: input.direction,
    overview,
    hotspots,
    milestones,
    researchers,
    entryPapers,
    generatedAt: input.generatedAt,
  };
}
