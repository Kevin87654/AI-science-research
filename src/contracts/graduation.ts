/**
 * 身份入口与毕业设计进度契约。
 *
 * 这一份描述**两个身份各自的可见数据**：
 *   · 大四学生：学校（学院）统一节点的固定时间轴 + 学生自己添加的节点；
 *   · 导师：组内学生名单 + 每个学生的自建节点。
 *
 * 目前身份校验与数据都还是**演示实现**（见 `src/features/auth/demo-accounts.ts`），
 * 但类型按"将来要落库"的形状写 —— 换成服务端接口时，字段不用改。
 * 与 `src/contracts/progress.ts` 的区别：那边是「学习路线里的任务状态」，
 * 这边是「毕业设计这件真实事务的时间轴」，两者语义不同，不要混用。
 */
import type { IsoDate, IsoDateTime } from "./common";

/** 需要登录的两个身份。`newcomer`（科研萌新）不需要登录，所以不在这个类型里。 */
export type Role = "student" | "mentor";

/** 首页三个可选择身份的键。 */
export type IdentityKey = Role | "newcomer";

/** 学校统一节点。由学院下达，所有学生共用一份，学生不能增删。 */
export interface GraduationMilestone {
  id: string;
  /** 展示用日期原文，可能只有月份或相对说法（如「答辩前 10 天」）。 */
  dateLabel: string;
  /** 能落到具体某一天时才填，用于「最近节点还有几天」这类计算；否则为 null。 */
  dueDate: IsoDate | null;
  title: string;
  detail: string;
  /** 该节点要求提交的材料。没有材料的节点是空数组。 */
  materials: string[];
}

/** 学生手动添加的节点。 */
export interface StudentNode {
  id: string;
  /** 学生自己填的日期，形如 `2026-11-15`。 */
  date: IsoDate;
  title: string;
  note: string | null;
  createdAt: IsoDateTime;
}

/** 展示用的账号档案。**不含密码** —— 密码只在登录校验处短暂出现。 */
export interface AccountProfile {
  /** 登录账号：学生是学号，导师是工号。 */
  id: string;
  role: Role;
  name: string;
  /** 一行所属信息，如「深圳大学 · 计算机与软件学院 · 软件工程」。 */
  affiliation: string;
  /** 再一行更细的说明，如「2022 级 · 大四」或「副教授 · 数据挖掘」。 */
  detail: string;
}

/** 前端保存的登录态（演示实现用 localStorage，将来换成服务端会话）。 */
export interface RoleSession {
  accountId: string;
  role: Role;
  name: string;
  signedInAt: IsoDateTime;
}
