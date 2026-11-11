import type { Metadata } from "next";

import { IdentityGate } from "@/features/welcome/identity-gate";

export const metadata: Metadata = {
  title: "选择你的身份",
  description: "大四学生追踪毕业设计进度，导师查看组内学生，科研萌新继续用科研小助理。",
};

/**
 * 首页 = 身份入口（2026-11-10 起）。
 *
 * 原来的科研小助理首页整页搬到了 `/assistant` —— 第三个身份「科研萌新」点进去就是它。
 * 这样 `/` 只承担一件事：让人先说自己是谁，再决定去哪。
 */
export default function HomePage() {
  return <IdentityGate />;
}
