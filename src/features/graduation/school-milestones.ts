/**
 * 毕业设计（学校/学院）统一节点。
 *
 * 数据来源：学院毕业设计动员会 PPT《毕业设计基本过程》——
 * 8 个节点按时间顺序排列，是所有学生共用、**不可增删**的那条时间轴。
 *
 * 两条录入约定：
 * 1. `dateLabel` 保留 PPT 上的原文（可能只有月份，或「答辩前 10 天」这种相对说法），
 *    界面上原样展示，不替学校"翻译"成具体日期。
 * 2. `dueDate` 只在学校给出了**具体某一天**时才填（选题 11/11、开题 12/11）。
 *    月份级、相对说法一律留 `null` —— 否则「还有几天」会算出一个学校并未承诺的数字，
 *    学生照着它安排进度是要出事的。
 */
import type { GraduationMilestone } from "@/contracts";

export const SCHOOL_MILESTONES: readonly GraduationMilestone[] = [
  {
    id: "topic",
    dateLabel: "2026年11月11日",
    dueDate: "2026-11-11",
    title: "完成选题，确认导师",
    detail: "与导师商定毕业设计题目，学院下达《毕业论文任务书》。",
    materials: ["毕业论文任务书"],
  },
  {
    id: "proposal",
    dateLabel: "2026年12月11日",
    dueDate: "2026-12-11",
    title: "完成调研分析，提交开题报告",
    detail: "在文献调研与需求分析的基础上完成开题，明确研究问题、技术路线与预期成果。",
    materials: ["开题报告"],
  },
  {
    id: "midterm",
    dateLabel: "2027年3月份",
    dueDate: null,
    title: "中期检查",
    detail: "提交《中期情况检查表》，汇报当前进度、遇到的问题与后续计划。",
    materials: ["中期情况检查表"],
  },
  {
    id: "writing",
    dateLabel: "2027年4月份",
    dueDate: null,
    title: "完成毕业设计并撰写论文",
    detail: "按照《深圳大学毕业论文（设计）撰写规范及要求》完成论文撰写与排版。",
    materials: ["毕业论文（设计）"],
  },
  {
    id: "submission",
    dateLabel: "答辩前 10 天",
    dueDate: null,
    title: "提交毕业论文（查重 + AIGC 检测）",
    detail: "按学院通知的时间提交定稿，完成查重与 AIGC 检测，并拿到检测结果。",
    materials: ["论文定稿", "查重报告", "AIGC 检测报告"],
  },
  {
    id: "review",
    dateLabel: "答辩前 6 天",
    dueDate: null,
    title: "毕业论文评审",
    detail: "评阅教师完成评阅并给出评阅意见，按意见修改论文。",
    materials: ["评阅意见表"],
  },
  {
    id: "defense",
    dateLabel: "2027年4月下旬",
    dueDate: null,
    title: "组织分组答辩，优秀毕业论文答辩",
    detail: "分组答辩，随后进行优秀毕业论文答辩；提前准备演示环境与答辩 PPT。",
    materials: ["答辩 PPT"],
  },
  {
    id: "extension",
    dateLabel: "答辩后 1 月内",
    dueDate: null,
    title: "延期答辩",
    detail: "未通过或需要修改的同学，在此阶段参加延期答辩。",
    materials: [],
  },
];
