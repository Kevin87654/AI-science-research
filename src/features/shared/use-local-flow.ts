"use client";

/**
 * 读取本地桥接数据的两个 Hook（B 负责）。
 *
 * 为什么不用 `useEffect(() => setFlow(loadFlow()), [])`：
 * 那是在副作用里同步改状态，会触发级联渲染，React 的新 lint 规则会直接报错。
 * `useSyncExternalStore` 正是为"订阅 React 之外的状态"而生的：
 * 服务端渲染时走 `getServerSnapshot`（返回 `null`），水合后自动切到真实快照。
 *
 * 因此界面必须**先用 `useIsClient()` 挡住首屏**，否则会把"服务端没有数据"
 * 误渲染成"用户没有数据"，先闪一下空状态再跳到内容。
 */
import { useSyncExternalStore } from "react";
import { getFlowSnapshot, getServerFlowSnapshot, subscribeFlow, type LocalFlow } from "./local-bridge";

/** 这个 store 永远不会变，只用来回答"现在是在浏览器里吗"。 */
const neverChanges = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(neverChanges, clientSnapshot, serverSnapshot);
}

export function useLocalFlow(): LocalFlow | null {
  return useSyncExternalStore(subscribeFlow, getFlowSnapshot, getServerFlowSnapshot);
}
