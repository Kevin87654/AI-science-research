import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { QaPanel } from "@/features/questions/qa-panel";
import { loadDataset } from "@/server/resources/dataset";

export const metadata: Metadata = {
  title: "科研问答",
  description: "只依据已核验的教师资料与整理过的常见问题回答；资料没有的会明确说无法确认。",
};

/**
 * 科研问答页。
 *
 * 快捷问题直接来自知识库的 FAQ（12 条），不在界面上另维护一份 —— 两处维护必然漂移，
 * 而且 FAQ 的 `questions` 本身已经被测试覆盖（每条都必须能返回带来源的回答）。
 */
export default function QuestionsPage() {
  const { knowledge } = loadDataset();

  const quickQuestions = knowledge.faqs.map((faq) => ({
    id: faq.id,
    question: faq.question,
    category: faq.category,
  }));

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <QaPanel quickQuestions={quickQuestions} />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>
    </>
  );
}
