import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { ToolDirectory } from "@/features/tools/tool-directory";
import { loadToolbox } from "@/server/resources/toolbox";

export const metadata: Metadata = {
  title: "科研工具箱",
  description:
    "搞科研常用的站点导航：论文库、学习资料与前沿资讯，附免费与否与语言说明。",
};

/**
 * 科研工具箱页。
 *
 * 数据在服务端读取并校验（`loadToolbox` 带 `server-only`），只把契约里的纯数据交给客户端组件；
 * 筛选与搜索在浏览器里做 —— 工具数量少，一次性传过去更快，断网时也能看已加载的列表。
 */
export default function ToolsPage() {
  const directory = loadToolbox();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <ToolDirectory directory={directory} />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>
    </>
  );
}
