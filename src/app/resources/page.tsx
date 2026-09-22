import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { TeacherDirectory } from "@/features/resources/teacher-directory";
import { loadDataset } from "@/server/resources/dataset";

export const metadata: Metadata = {
  title: "教师公开资料",
  description:
    "深圳大学计算机与软件学院首批教师样本：公开研究方向、公开邮箱、官网招募说明与可追溯来源。",
};

/**
 * 教师资料页。
 *
 * 数据集在**服务端**读取（`loadDataset` 带 `server-only`），只把契约里的纯数据交给客户端组件，
 * 筛选与展开在浏览器里做 —— 首批样本只有十位，一次性传过去比每次筛选都打一次接口更快，
 * 也顺带让页面在断网时仍然可用。
 *
 * 后续数据量上去以后，检索应当移到服务端（`/api/...`）；那时改的是这一处的取数方式，
 * 纯函数与组件都不用动。
 */
export default function ResourcesPage() {
  const { catalog } = loadDataset();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <TeacherDirectory catalog={catalog} />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
