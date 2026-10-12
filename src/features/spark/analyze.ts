/**
 * 「奇思妙想」AI 输出的解析与校验（B 负责）—— 纯函数，可脱离网络单测。
 *
 * 职责边界与 `assessment-coach` 一致：模型只负责"读文本、写 JSON"，
 * **方向 id 是否合法由这里判定** —— 模型返回的 `interestIds` 必须落在
 * `interest/directions.ts` 的 `INTEREST_DIRECTIONS` 里，非法 id 一律丢弃，
 * 绝不把一个模型编出来的方向放进用户数据。
 *
 * 校验刻意**宽松但不放水**：字段缺失当空数组处理、超长截断、非法项丢弃；
 * 但两个核心输出（亮点 / 兴趣方向）至少有一个有用才返回结果，否则 `null`
 * 让调用方去兜底 —— 宁可不给，也不给一句"模型编的方向"。
 */
import type { SparkAnalysis } from "@/contracts";
import { toInterestTag } from "../interest/directions.ts";

const SCHEMA_VERSION = "1.0.0";

/** 单条输入的长度上限（接口层与界面共用）。 */
export const MAX_SPARK_TEXT = 2000;

const MAX_HIGHLIGHTS = 5;
const MAX_INTERESTS = 3;
const MAX_RATIONALE = 200;
const MAX_RESPONSE = 140;

const MAX_HIGHLIGHT_LENGTH = 80;

/** 空白折叠 + 截断。界面文案用，不留换行与多余空格。 */
export function clipText(text: string, limit: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

/** 模型有时会套上 ```json 代码块或写点前言，所以只截取最外层的花括号。 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 从任意值里取出非空字符串数组，非字符串项一律丢弃。 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * 把模型的原始文本解析成 `SparkAnalysis`。
 *
 * 返回 `null` 表示"这次拿不出可信结果"（不是 JSON、或亮点与方向全空），
 * 由调用方兜底。字段说明见 `contracts/spark.ts`。
 */
export function parseSparkAnalysis(input: {
  modelText: string;
  id: string;
  text: string;
  generatedAt: string;
}): SparkAnalysis | null {
  const parsed = parseJsonObject(input.modelText);
  if (!parsed) return null;

  const highlights = toStringArray(parsed.highlights)
    .map((item) => clipText(item, MAX_HIGHLIGHT_LENGTH))
    .slice(0, MAX_HIGHLIGHTS);

  // 方向 id 只认固定目录；非法 id 丢弃，最多保留 MAX_INTERESTS 个。
  const interests = [];
  for (const id of toStringArray(parsed.interestIds)) {
    const tag = toInterestTag(id);
    if (tag) interests.push(tag);
    if (interests.length >= MAX_INTERESTS) break;
  }

  // 两个核心输出至少有一个有用才成立；否则调用方兜底（不编造方向）。
  if (interests.length === 0 && highlights.length === 0) return null;

  const rationaleRaw = typeof parsed.rationale === "string" ? parsed.rationale : "";
  const rationale =
    clipText(rationaleRaw, MAX_RATIONALE) ||
    "你的想法里已经能看到一些方向的影子，下面的方向供你参考。";

  const response =
    typeof parsed.response === "string" && parsed.response.trim().length > 0
      ? clipText(parsed.response, MAX_RESPONSE)
      : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    text: input.text,
    highlights,
    interests,
    rationale,
    response,
    generatedAt: input.generatedAt,
  };
}
