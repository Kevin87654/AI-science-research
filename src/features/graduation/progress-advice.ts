/**
 * 学生进度 AI 的**纯逻辑**：请求校验、模型输出解析、规则兜底。
 *
 * 为什么不直接写在 API 里：这三件事都值得被单测守住，而且都**不该依赖网络** ——
 * 模型挂了、返回半截 JSON、客户端传了坏节点，都要在这里被挡住或降级，
 * 而不是让页面转圈或把脏数据喂给模型。
 */
import type {
  GraduationMilestone,
  GraduationReminder,
  GraduationSummary,
  StudentNode,
} from "@/contracts";

import { NODE_NOTE_MAX, NODE_TITLE_MAX } from "./node-rules.ts";
import { daysBetween, parseIsoDate, pickNextMilestone } from "./timeline-meta.ts";

/** 一次最多接收的学生节点数。界面不会这么多，挡住异常大的请求体。 */
const MAX_NODES = 50;

/** 提醒标题 / 条目 / 汇总标题的长度上限（按字符）。 */
const MAX_HEADLINE = 80;
const MAX_ITEM = 120;
const MAX_SUMMARY_TITLE = 40;
const MAX_SUMMARY_BODY = 1800;

export interface ProgressContext {
  /** 客户端本地日期，形如 `2026-11-12`。 */
  today: string;
  nodes: readonly StudentNode[];
  milestones: readonly GraduationMilestone[];
}

export interface ReminderDraft {
  headline: string;
  items: string[];
}

export interface SummaryDraft {
  title: string;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 模型有时套 ```json 或写点前言，只取最外层花括号。 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 单行文本：压掉换行与多余空白。 */
function clipLine(text: string, limit: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

/** 多行正文：保留换行，只做长度截断。 */
function clipBlock(text: string, limit: number): string {
  const normalized = text.trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

/** 解析模型返回的提醒 JSON；结构不完整返回 `null`，由调用方降级。 */
export function parseReminderDraft(text: string): ReminderDraft | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const headline = typeof parsed.headline === "string" ? clipLine(parsed.headline, MAX_HEADLINE) : "";
  if (headline.length === 0) return null;

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of rawItems) {
    if (typeof raw !== "string") continue;
    const item = clipLine(raw, MAX_ITEM);
    if (item.length === 0 || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (items.length >= 5) break;
  }
  if (items.length === 0) return null;

  return { headline, items };
}

/** 解析模型返回的成果汇总 JSON；正文为空或标题为空则降级。 */
export function parseSummaryDraft(text: string): SummaryDraft | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const title = typeof parsed.title === "string" ? clipLine(parsed.title, MAX_SUMMARY_TITLE) : "";
  const body = typeof parsed.body === "string" ? clipBlock(parsed.body, MAX_SUMMARY_BODY) : "";
  if (title.length === 0 || body.length === 0) return null;

  return { title, body };
}

export interface ProgressAiInput {
  studentId: string;
  today: string;
  nodes: StudentNode[];
}

/**
 * 校验 AI 接口入参。
 *
 * 节点是客户端带上来的（还不在数据库里），所以只做**形状校验 + 截断**：
 * 日期必须真实存在、标题/备注长度符合录入规则、最多 50 条。
 */
export function parseProgressAiInput(value: unknown): ProgressAiInput | null {
  if (!isRecord(value)) return null;

  const studentId = typeof value.studentId === "string" ? value.studentId.trim() : "";
  if (studentId.length === 0 || studentId.length > 32) return null;

  const today = typeof value.today === "string" ? value.today.trim() : "";
  if (!parseIsoDate(today)) return null;

  if (!Array.isArray(value.nodes) || value.nodes.length > MAX_NODES) return null;

  const nodes: StudentNode[] = [];
  for (const raw of value.nodes) {
    if (!isRecord(raw)) return null;
    if (typeof raw.id !== "string" || raw.id.length === 0 || raw.id.length > 80) return null;
    if (typeof raw.date !== "string" || !parseIsoDate(raw.date)) return null;
    if (typeof raw.title !== "string") return null;

    const title = raw.title.trim();
    if (title.length === 0 || title.length > NODE_TITLE_MAX) return null;

    const note = raw.note === null || raw.note === undefined ? null : raw.note;
    if (note !== null && (typeof note !== "string" || note.length > NODE_NOTE_MAX)) return null;

    if (typeof raw.createdAt !== "string" || Number.isNaN(Date.parse(raw.createdAt))) return null;

    nodes.push({
      id: raw.id,
      date: raw.date,
      title,
      note: note === null ? null : note.trim() || null,
      createdAt: raw.createdAt,
    });
  }

  return { studentId, today, nodes };
}

function sortedNodes(nodes: readonly StudentNode[]): StudentNode[] {
  return [...nodes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function duePhrase(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "，就是今天";
  if (days > 0) return `，还有 ${days} 天`;
  return `，已过去 ${Math.abs(days)} 天`;
}

/**
 * 规则兜底提醒：AI 不可用时也要给出**基于学院时间轴**的判断。
 *
 * 只使用两类事实：学院节点、学生自己的记录。不推测学生没写过的进度。
 */
export function buildRuleReminder(context: ProgressContext): GraduationReminder {
  const nodes = sortedNodes(context.nodes);
  const latest = nodes.length > 0 ? nodes[nodes.length - 1] : null;
  const next = pickNextMilestone(context.milestones, context.today);
  const daysToNext = next?.dueDate ? daysBetween(context.today, next.dueDate) : null;
  const daysSinceLatest = latest ? daysBetween(latest.date, context.today) : null;

  const items: string[] = [];

  if (next) {
    items.push(`下一个学院节点：${next.dateLabel}「${next.title}」${duePhrase(daysToNext)}。`);
    if (next.materials.length > 0) {
      items.push(`这个节点要准备：${next.materials.join("、")}。`);
    }
  } else {
    items.push("学院时间轴的节点都已走完，接下来等成绩与归档通知。");
  }

  if (latest) {
    items.push(
      `你最近一条记录是 ${latest.date}「${latest.title}」${daysSinceLatest !== null && daysSinceLatest > 0 ? `，距今 ${daysSinceLatest} 天` : ""}。`,
    );
  } else {
    items.push("你还没有记录任何进度，先补一条最近做过的事（读文献、跑实验、和导师讨论都可以）。");
  }

  if (daysSinceLatest !== null && daysSinceLatest >= 14) {
    items.push(`已有 ${daysSinceLatest} 天没有更新进度，建议今天补记一条，别让导师看不到进展。`);
  } else if (daysToNext !== null && daysToNext >= 0 && daysToNext <= 14) {
    items.push(`距下一个节点不到两周，建议把材料拆到今天就能动手的一步。`);
  } else {
    items.push("每完成一件事就记一条，对照学院节点时才有依据。");
  }

  let headline: string;
  if (!next) headline = "学院节点已走完，收尾阶段别漏掉归档。";
  else if (nodes.length === 0) headline = "还没有进度记录，先补一条再对照时间轴。";
  else if (daysToNext !== null && daysToNext >= 0 && daysToNext <= 7) headline = "下一个节点就在眼前，先把材料备齐。";
  else if (daysSinceLatest !== null && daysSinceLatest >= 14) headline = "进度有一段时间没更新了，建议今天补记。";
  else headline = "进度在正常推进，按学院节点继续走。";

  return { source: "rule", headline, items: items.slice(0, 4) };
}

/** 规则兜底汇总：把节点按「已完成 / 对照节点 / 下一步」整理成一段可直接发送的汇报。 */
export function buildRuleSummary(context: ProgressContext): GraduationSummary {
  const nodes = sortedNodes(context.nodes);
  const next = pickNextMilestone(context.milestones, context.today);

  const lines: string[] = [`老师好，这是我截至 ${context.today} 的毕设进度汇报。`, ""];

  lines.push("【已完成】");
  if (nodes.length === 0) {
    lines.push("- 目前还没有在系统里记录进度。");
  } else {
    for (const node of nodes.slice(-10)) {
      lines.push(`- ${node.date} ${node.title}${node.note ? `：${node.note}` : ""}`);
    }
    if (nodes.length > 10) lines.push(`- （更早还有 ${nodes.length - 10} 条记录）`);
  }

  lines.push("", "【对照学院时间轴】");
  if (next) {
    lines.push(
      `- 下一个节点：${next.dateLabel}「${next.title}」${duePhrase(next.dueDate ? daysBetween(context.today, next.dueDate) : null)}。`,
    );
    if (next.materials.length > 0) lines.push(`- 需要准备：${next.materials.join("、")}。`);
  } else {
    lines.push("- 学院时间轴的节点已走完，进入成绩与归档阶段。");
  }

  lines.push("", "【下一步计划】");
  lines.push(
    nodes.length === 0
      ? "- 先把最近做过的事补记到进度里，再按学院节点准备下一份材料。"
      : "- 按学院节点继续推进；有新的进展我会继续记录在这里。",
  );

  lines.push("", "【想请老师确认】");
  lines.push("- 目前这个节奏是否合适？下一步的重点要不要调整？");

  return {
    source: "rule",
    title: `毕设进度汇报（${context.today}）`,
    body: clipBlock(lines.join("\n"), MAX_SUMMARY_BODY),
    nodeCount: nodes.length,
  };
}
