import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { RoadmapBoard } from "@/features/roadmap/roadmap-board";
import { loadDataset } from "@/server/resources/dataset";

export const metadata: Metadata = {
  title: "学习路线",
  description: "把「想做科研」拆成有顺序、有完成标准的小任务，并记录每一项的进度。",
};

/**
 * 学习路线页。
 *
 * 任务的 `resourceIds` 只是 id，**标题与链接由服务端从可信资料集还原**——
 * 与引用同一条规矩：URL 不写进用户数据，只由来源注册表给出（PRD §13.6）。
 * 七条来源一次传过去，卡片上按需取用。
 */
export default function RoadmapPage() {
  const { knowledge } = loadDataset();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <RoadmapBoard sources={knowledge.sources} />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
