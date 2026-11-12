/**
 * 「学生联系哪位导师」的解析（纯函数，无存储读写）。
 *
 * 正常路径：导师把学生加进小组后，`mentor-groups` 里就有这条关系。
 * 兜底路径：演示期还没建关系时，学生端也要能打开对话，所以落到演示导师。
 * 真接数据库后，这里改成查 `mentor_students` 关系表即可，界面不用动。
 */
import { DEMO_MENTOR_ID } from "@/features/auth/demo-accounts";

import { mentorOfStudent, type MentorGroupsState } from "./mentor-groups";

export function mentorIdForStudent(state: MentorGroupsState | null, studentId: string): string {
  return mentorOfStudent(state, studentId) ?? DEMO_MENTOR_ID;
}
