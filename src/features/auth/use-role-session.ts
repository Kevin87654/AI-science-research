"use client";

/**
 * 读当前登录态（演示实现见 `session-store.ts`）。
 *
 * 与项目里其它本地状态一样用 `useSyncExternalStore`：
 * 服务端渲染返回 `null`，水合后切到真实值，避免"服务端没数据"被渲染成"没登录"。
 * ⚠️ 界面仍然要先用 `useIsClient()` 挡住首屏，否则会闪一下"请先登录"。
 */
import { useSyncExternalStore } from "react";

import {
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
  type StoredSession,
} from "./session-store";

export function useRoleSession(): StoredSession | null {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot);
}
