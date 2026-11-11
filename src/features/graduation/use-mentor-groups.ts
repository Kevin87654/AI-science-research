"use client";

/** 订阅「导师组内学生名单」的本地状态。首屏仍需 `useIsClient()` 挡住。 */
import { useSyncExternalStore } from "react";

import {
  getGroupsSnapshot,
  getServerGroupsSnapshot,
  subscribeGroups,
  type MentorGroupsState,
} from "./mentor-groups";

export function useMentorGroupsState(): MentorGroupsState | null {
  return useSyncExternalStore(subscribeGroups, getGroupsSnapshot, getServerGroupsSnapshot);
}
