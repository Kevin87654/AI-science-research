import type { Metadata } from "next";

import { MentorWorkspace } from "@/features/graduation/mentor-workspace";

export const metadata: Metadata = {
  title: "导师管理",
  description: "搜索学生、组建小组，查看组内学生的毕设进度。",
};

export default function MentorPage() {
  return <MentorWorkspace />;
}
