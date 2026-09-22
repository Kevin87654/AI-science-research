/**
 * 校内资源目录的检索纯函数（C 模块）。
 *
 * 迁移自 C 模块 demo（`member-c/src/engine.mjs` 的检索部分），行为保持一致，
 * 只补类型、并把「框架无关」这条性质明确下来：**这里不读文件、不发请求、不碰环境变量**，
 * 数据一律由调用方传入。这样它既能在服务端跑，也能在浏览器里跑，还能脱离网络单测。
 *
 * 几条已经固化的产品红线（改动前先看 `src/contracts/catalog.ts` 的注释）：
 * - **只做正向条件检索**。需要排除条件时返回范围提示，见 `@/features/questions/engine`；
 * - 标签匹配是"探索线索"，**不是**导师评分或录取概率；
 * - 名额一律不猜（`recruitment.currentAvailability` 恒为 `unknown`）。
 */
import type { Catalog, Knowledge, Match, SearchOptions, Source, Teacher } from "@/contracts";

/**
 * 研究方向别名表：把常见简称/英文/口语说法折到官方的方向标签上。
 *
 * 用 `Object.freeze` 而不是 `as const`，是因为这里查表发生在运行时
 * （用户可能输入 `AI`、`ai`、`Ai`），需要真的不可变而不只是类型层面。
 */
export const DIRECTION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ai: "人工智能",
  人工智慧: "人工智能",
  大模型: "AIGC",
  agent: "智能体",
  iot: "物联网",
  智能物联网: "物联网",
  cv: "计算机视觉",
  nlp: "自然语言处理",
  推荐服务: "推荐系统",
  多模态机器学习: "多模态学习",
  云边计算: "边缘计算",
});

/** 统一大小写、全角半角与首尾空白。所有比较都必须先过这一层。 */
export function normalizeKeyword(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

/** 把用户输入折成官方方向标签；不是别名就原样返回（去首尾空白后的原始写法）。 */
export function canonicalTag(value: unknown): string {
  const normalized = normalizeKeyword(value);
  return DIRECTION_ALIASES[normalized] ?? String(value ?? "").trim();
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** 目录里出现过的全部方向标签，按中文排序。供筛选器与兜底提示使用。 */
export function allDirections(teachers: readonly Teacher[]): string[] {
  return unique(teachers.flatMap((teacher) => teacher.directions)).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

/**
 * 把画像的兴趣标签与教师方向做匹配（B → C 的联动入口）。
 *
 * 返回的 `reasons` 必须能解释"为什么推荐"，否则界面上会出现没有依据的推荐。
 */
export function matchInterests(teacher: Teacher, interests: readonly string[] = []): Omit<Match, "teacher"> {
  const requested = unique(interests.map((tag) => canonicalTag(tag)).filter(Boolean));
  const matchedTags = requested.filter((tag) => teacher.directions.includes(tag));

  return {
    matchedTags,
    reasons: matchedTags.map((tag) => `兴趣“${tag}”与官方介绍中的研究方向标签对应。`),
    disclaimer: "标签匹配是探索线索，不是导师评分或录取概率。",
  };
}

/**
 * 按关键词 / 方向 / 学院 / 是否欢迎本科生检索教师。
 *
 * 关键词是**所有词都要命中**（AND），空格分词；空白输入返回全部。
 * 排序：先按命中的兴趣标签数降序，再按 id 升序 —— 稳定排序，
 * 保证同一输入在两次运行里给出同样顺序（评测时要能复现）。
 */
export function searchTeachers(teachers: readonly Teacher[], options: SearchOptions = {}): Match[] {
  const { query = "", direction = "", college = "", undergraduateOnly = false, interests = [] } = options;

  const terms = normalizeKeyword(query)
    .split(/\s+/u)
    .filter(Boolean)
    .map((term) => canonicalTag(term))
    .map((term) => normalizeKeyword(term));

  return teachers
    .filter((teacher) => {
      const haystack = normalizeKeyword(
        [
          teacher.name,
          teacher.school,
          teacher.college,
          teacher.researchUnit,
          teacher.title ?? "",
          teacher.summary,
          ...teacher.directions,
        ].join(" "),
      );

      return (
        terms.every((term) => haystack.includes(term)) &&
        (!direction || teacher.directions.includes(canonicalTag(direction))) &&
        (!college || teacher.college === college) &&
        (!undergraduateOnly || teacher.recruitment.status === "页面欢迎本科生")
      );
    })
    .map((teacher) => ({ teacher, ...matchInterests(teacher, interests) }))
    .sort(
      (a, b) => b.matchedTags.length - a.matchedTags.length || a.teacher.id.localeCompare(b.teacher.id),
    );
}

/**
 * 来源新鲜度。
 *
 * ⚠️ 它衡量的是**我们上次核对页面的时间**，不是学校更新内容的时间 ——
 * 两者常被混为一谈，所以文案里刻意不出现"页面已更新"这类说法。
 */
export function sourceFreshness(
  source: Pick<Source, "checkedAt">,
  today: string = new Date().toISOString().slice(0, 10),
): string {
  const elapsed = Date.parse(today) - Date.parse(source.checkedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "核验日期异常";
  return elapsed > 90 * 86400000 ? "超过90天，建议重新核验" : "已核验页面，当前名额仍需确认";
}

/** 来源注册表：教师来源与知识库来源合并，按 id 索引。引用只能从这里还原。 */
export function sourceRegistry(catalog: Catalog, knowledge: Knowledge): Map<string, Source> {
  const all = [...catalog.teachers.map((teacher) => teacher.source), ...knowledge.sources];
  return new Map(all.map((source) => [source.id, source] as const));
}
