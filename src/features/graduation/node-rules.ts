/**
 * 学生手动添加节点的输入校验（纯函数，可被单测直接加载）。
 *
 * 校验放在这里而不是直接写在组件里，是因为它有三条硬要求，且都值得被测试守住：
 * 1. 日期必须是**真实存在**的那一天（`2026-02-31` 要被挡住，不能只做正则）；
 * 2. 标题去掉首尾空白后不能为空，且不超过上限（数据库列长的预演）；
 * 3. 备注可以为空，空的要落成 `null` 而不是空字符串 —— 与 `task_progress.note` 同一约定。
 */
import { parseIsoDate } from "./timeline-meta.ts";

/** 标题上限。与 `task_progress` 的 100 字符列长相比留了余量，界面也不会被长标题撑破。 */
export const NODE_TITLE_MAX = 40;

/** 备注上限。 */
export const NODE_NOTE_MAX = 200;

export interface NodeDraft {
  date: string;
  title: string;
  note: string;
}

export interface ValidNodeDraft {
  date: string;
  title: string;
  note: string | null;
}

export type NodeDraftField = "date" | "title" | "note";

export type NodeDraftResult =
  | { ok: true; value: ValidNodeDraft }
  | { ok: false; field: NodeDraftField; message: string };

/** 允许的日期区间：毕业设计这件事不会早于 2020，也不会晚于 2100。 */
const MIN_YEAR = 2020;
const MAX_YEAR = 2100;

export function validateNodeDraft(draft: NodeDraft): NodeDraftResult {
  const date = draft.date.trim();
  const parsed = parseIsoDate(date);
  if (!parsed) {
    return { ok: false, field: "date", message: "请选择一个有效的日期。" };
  }
  if (parsed.year < MIN_YEAR || parsed.year > MAX_YEAR) {
    return { ok: false, field: "date", message: `日期请填 ${MIN_YEAR}～${MAX_YEAR} 年之间。` };
  }

  const title = draft.title.trim();
  if (title.length === 0) {
    return { ok: false, field: "title", message: "请写一句这个节点的标题。" };
  }
  if (title.length > NODE_TITLE_MAX) {
    return { ok: false, field: "title", message: `标题最多 ${NODE_TITLE_MAX} 个字。` };
  }

  const note = draft.note.trim();
  if (note.length > NODE_NOTE_MAX) {
    return { ok: false, field: "note", message: `备注最多 ${NODE_NOTE_MAX} 个字。` };
  }

  return { ok: true, value: { date, title, note: note.length === 0 ? null : note } };
}
