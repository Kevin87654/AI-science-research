import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { AssessmentForm } from "@/features/assessment/assessment-form";

export const metadata: Metadata = {
  title: "科研认知测评",
  description: "用几分钟了解自己对科研、论文、检索与方法的当前认知，生成属于自己的科研画像。",
};

export default function AssessmentPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <AssessmentForm />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
