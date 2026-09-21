/**
 * 界面共用的展示格式化（B 负责）。
 *
 * 放在一个地方，避免"进度页显示未开始、首页显示还没做"这种同义不同词的混乱 ——
 * 枚举译文在界面上必须只有一套。
 */
import type { TaskProgressStatus } from "@/contracts";

export const TASK_STATUS_LABELS: Record<TaskProgressStatus, string> = {
  "not-started": "未开始",
  "in-progress": "进行中",
  completed: "已完成",
  skipped: "已跳过",
};

/** 界面上的排序权重：进行中在最前，其次是未开始、已完成、已跳过。 */
export const TASK_STATUS_ORDER: Record<TaskProgressStatus, number> = {
  "in-progress": 0,
  "not-started": 1,
  completed: 2,
  skipped: 3,
};

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

/** 分钟数转成人类可读的耗时，例如 `1 小时 15 分钟`。 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`;
}

export function formatWeeks(weeks: number): string {
  return weeks <= 1 ? "约 1 周" : `约 ${weeks} 周`;
}
