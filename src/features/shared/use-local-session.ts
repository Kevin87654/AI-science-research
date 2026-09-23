"use client";

/**
 * 读「过程草稿」的两个 Hook（PRD §4.6 的 C1 / C2，fodenspider 负责）。
 *
 * 为什么不用 `useEffect(() => setX(load()), [])`：那是在副作用里同步改状态，
 * 会触发级联渲染，React 的新 lint 规则直接报错 —— 本项目已经踩过一次。
 * `useSyncExternalStore` 正是为"订阅 React 之外的状态"而生的：
 * 服务端渲染走 `getServerSnapshot`（返回 `null`），水合后自动切到真实快照。
 *
 * ⚠️ 界面必须**先用 `useIsClient()` 挡住首屏**，否则会把"服务端没有数据"
 * 误渲染成"用户没有数据"，先闪一下空状态再跳到内容。
 */
import { useSyncExternalStore } from "react";

import {
  getDraftServerSnapshot,
  getDraftSnapshot,
  getQaLastServerSnapshot,
  getQaLastSnapshot,
  subscribeDraft,
  subscribeQaLast,
  type AssessmentDraft,
  type QaLast,
} from "./local-session";

/** 最近一次问答（C2）。没有、过期、或数据坏了都返回 `null`。 */
export function useQaLast(): QaLast | null {
  return useSyncExternalStore(subscribeQaLast, getQaLastSnapshot, getQaLastServerSnapshot);
}

/** 没答完的测评草稿（C1）。没有、过期、或数据坏了都返回 `null`。 */
export function useAssessmentDraft(): AssessmentDraft | null {
  return useSyncExternalStore(subscribeDraft, getDraftSnapshot, getDraftServerSnapshot);
}
