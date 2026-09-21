import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "成长首页",
  description: "你当前的科研阶段、下一项该做的任务，以及已经完成的事。",
};

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <DashboardView />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
