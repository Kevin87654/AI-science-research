import type { Metadata } from "next";

import { StudentWorkspace } from "@/features/graduation/student-workspace";

export const metadata: Metadata = {
  title: "毕设进度追踪",
  description: "学院统一节点与你自己记录的进度，两条时间轴对照着看。",
};

export default function StudentPage() {
  return <StudentWorkspace />;
}
