/**
 * 进度提醒 / 成果汇总的提示词（纯函数，可被单测直接加载）。
 *
 * 单独拆出来有两个原因：
 * 1. 提示词是这个功能的核心资产，值得像代码一样被测试和审查；
 * 2. 测试与本地实测脚本可以在不加载 `server-only` 的情况下复用同一份提示词，
 *    避免"测的版本"和"线上版本"漂移。
 */
import type { ProgressAiInput } from "./progress-advice";
import { SCHOOL_MILESTONES } from "./school-milestones.ts";
import { pickNextMilestone } from "./timeline-meta.ts";

function milestoneLines(): string {
  return SCHOOL_MILESTONES.map((milestone) => {
    const materials =
      milestone.materials.length > 0 ? `｜需要：${milestone.materials.join("、")}` : "";
    return `- ${milestone.dateLabel}｜${milestone.title}${materials}`;
  }).join("\n");
}

function nodeLines(input: ProgressAiInput): string {
  if (input.nodes.length === 0) return "（学生还没有记录任何节点）";
  return input.nodes
    .map((node) => `- ${node.date}｜${node.title}${node.note ? `｜备注：${node.note}` : ""}`)
    .join("\n");
}

function nextMilestoneLine(today: string): string {
  const next = pickNextMilestone(SCHOOL_MILESTONES, today);
  if (!next) return "学院时间轴的节点都已走完，进入成绩与归档阶段。";
  return `${next.dateLabel}｜${next.title}`;
}

export function buildReminderPrompt(input: ProgressAiInput): string {
  return [
    "你是深圳大学计算机与软件学院的大四毕业设计进度助手。",
    `今天是 ${input.today}。`,
    "",
    "【学院统一的毕设时间轴】只能引用下面的事实，不要自己编日期：",
    milestoneLines(),
    "",
    "【学生自己记录的进度】",
    nodeLines(input),
    "",
    "【任务】",
    "对照时间轴判断这个学生现在的进度，给出 2～4 条具体、可执行的提醒。",
    "",
    "【硬要求】",
    "- 只依据上面的事实，不编造学生没做过的事，不承诺学院没写过的日期。",
    "- 如果下一个节点在 7 天内，明确说还剩几天；如果学生最近 14 天没有记录，指出来。",
    "- 语气平实，不制造焦虑；每条不超过 60 字。",
    "- 只输出一个 JSON 对象，不要代码块标记、不要任何解释：",
    '{"headline":"一句话总体判断（不超过 40 字）","items":["提醒 1","提醒 2"]}',
  ].join("\n");
}

export function buildSummaryPrompt(input: ProgressAiInput, studentName?: string): string {
  const identity = studentName
    ? `这个学生叫${studentName}，用第一人称「我」来写，不要写学号。`
    : "不要写学号或姓名，直接以第一人称「我」的口吻写。";

  return [
    "你在帮一个大四学生把毕设阶段成果整理成一条发给导师的进度汇报。",
    `今天是 ${input.today}。`,
    identity,
    "",
    "【学院时间轴的下一个节点】",
    nextMilestoneLine(input.today),
    "",
    "【学生自己记录的进度】",
    nodeLines(input),
    "",
    "【任务】",
    "写一条 300～500 字的进度汇报，按下面四段组织：",
    "【已完成】做过什么；【当前进展】现在到哪一步；【下一步计划】接下来做什么；【想请老师确认】需要老师拿主意的地方。",
    "",
    "【硬要求】",
    "- 只写记录里出现过的事实，不夸大、不编造；记录少就如实说明。",
    "- 用第一人称，像学生本人写给导师，不要写「根据系统记录」这类元话术。",
    "- 语气尊重、具体，不要空话。",
    "- 只输出一个 JSON 对象，不要代码块标记、不要任何解释：",
    '{"title":"汇报标题（不超过 30 字）","body":"汇报正文，用 \\n 分段"}',
  ].join("\n");
}
