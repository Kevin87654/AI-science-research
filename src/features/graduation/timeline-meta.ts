/**
 * 时间轴的纯计算（无 React、无浏览器 API，可被单测直接加载）。
 *
 * 只做三件事：日期格式化、两个日期之间差几天、以及「某个截止日还有多久」。
 * 刻意**不引入任何日期库**：这里要处理的只有 `YYYY-MM-DD`，用 `Date.UTC` 手算
 * 比引一个依赖更可控，也不会因为本地时区/夏令时把「还有 1 天」算成「还有 0 天」。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 把 `2026-11-15` 拆成数字；形状不对返回 `null`（调用方据此判断"不是合法日期"）。 */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 用 UTC 构造再回读：这样 2026-02-31 这种"形状对、日期不存在"会被挡下来。
  const stamp = Date.UTC(year, month - 1, day);
  const date = new Date(stamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** 本地时区的「今天」，形如 `2026-11-10`。不能用 `toISOString()` —— 那是 UTC，凌晨会差一天。 */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `2026-11-15` → `2026年11月15日`。形状不合法就原样返回，界面上不至于出现 `NaN`。 */
export function formatIsoDate(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return `${parsed.year}年${parsed.month}月${parsed.day}日`;
}

/** `to - from` 的天数差（向下取整，晚于为负）。任一参数不合法返回 `null`。 */
export function daysBetween(from: string, to: string): number | null {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return null;
  const startStamp = Date.UTC(start.year, start.month - 1, start.day);
  const endStamp = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endStamp - startStamp) / DAY_MS);
}

export type DueState = "upcoming" | "today" | "overdue";

export interface DueInfo {
  /** 距截止日的天数：正数=还剩，0=就是今天，负数=已过去。日期不合法为 `null`。 */
  days: number | null;
  state: DueState;
  /** 直接可以放进界面的短文案。 */
  label: string;
}

/**
 * 「这个节点还有几天」。
 *
 * `state` 与 `label` 一起返回，是因为界面两处都要用：状态决定样式（黄/黑/灰），
 * 文案决定说什么。让调用方自己拼容易出现"还剩 -3 天"这种句子。
 */
export function describeDue(dueDate: string, today: string): DueInfo {
  const days = daysBetween(today, dueDate);
  if (days === null) {
    return { days: null, state: "upcoming", label: "日期待定" };
  }
  if (days === 0) return { days, state: "today", label: "就是今天" };
  if (days > 0) return { days, state: "upcoming", label: `还有 ${days} 天` };
  return { days, state: "overdue", label: `已过去 ${Math.abs(days)} 天` };
}

/** 取日期最晚的一条（学生节点列表用）。空数组返回 `null`。 */
export function latestByDate<T extends { date: string }>(nodes: readonly T[]): T | null {
  if (nodes.length === 0) return null;
  return nodes.reduce((latest, node) => (node.date > latest.date ? node : latest));
}

/**
 * 从学校节点里挑出「下一个还没到的节点」。
 *
 * 只认有具体日期的节点：`dueDate` 为 `null` 的那些（审核区间、寒假、「开学第一周」）无法参与比较，
 * 硬算只会给出一个假的倒计时。
 */
export function pickNextMilestone<T extends { dueDate: string | null }>(
  milestones: readonly T[],
  today: string,
): T | null {
  let best: T | null = null;
  let bestDays = Number.POSITIVE_INFINITY;
  for (const milestone of milestones) {
    if (!milestone.dueDate) continue;
    const days = daysBetween(today, milestone.dueDate);
    if (days === null || days < 0) continue;
    if (days < bestDays) {
      best = milestone;
      bestDays = days;
    }
  }
  return best;
}
