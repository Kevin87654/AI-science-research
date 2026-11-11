"use client";

/** 订阅「学生自建节点」的本地状态。首屏仍需 `useIsClient()` 挡住。 */
import { useSyncExternalStore } from "react";

import {
  getNodesSnapshot,
  getServerNodesSnapshot,
  subscribeNodes,
  type StudentNodesState,
} from "./student-nodes";

export function useStudentNodesState(): StudentNodesState | null {
  return useSyncExternalStore(subscribeNodes, getNodesSnapshot, getServerNodesSnapshot);
}
