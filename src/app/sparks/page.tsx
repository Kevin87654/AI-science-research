import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { SparkPanel } from "@/features/spark/spark-panel";

export const metadata: Metadata = {
  title: "奇思妙想",
  description: "写下你的想法、灵感与日常记录，让 AI 从中发现你的亮点和感兴趣的方向。",
};

/**
 * 奇思妙想页。
 *
 * 分析在服务端做（付费模型、需会话），记录在本地 —— 与画像 / 路线同一套过渡策略。
 */
export default function SparksPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <SparkPanel />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>
    </>
  );
}
