"use client";

/**
 * 订阅奇思妙想 / 前置路线本地状态的 Hook（B 负责）。
 *
 * 与 `use-local-flow.ts` 同一个理由：用 `useSyncExternalStore` 订阅外部存储，
 * 而不是在 `useEffect` 里 `setState`（那会触发级联渲染）。首屏用 `useIsClient`
 * 挡住 —— 服务端没有 localStorage，不挡会把"服务端无数据"渲染成"用户无记录"。
 */
import { useSyncExternalStore } from "react";
import {
  getServerSparkStateSnapshot,
  getSparkStateSnapshot,
  subscribeSparkState,
  type SparkState,
} from "./store";

export function useSparkState(): SparkState {
  return useSyncExternalStore(subscribeSparkState, getSparkStateSnapshot, getServerSparkStateSnapshot);
}
