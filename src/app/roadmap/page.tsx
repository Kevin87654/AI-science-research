import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RoadmapBoard } from "@/features/roadmap/roadmap-board";

export const metadata: Metadata = {
  title: "学习路线",
  description: "把「想做科研」拆成有顺序、有完成标准的小任务，并记录每一项的进度。",
};

export default function RoadmapPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <RoadmapBoard />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
