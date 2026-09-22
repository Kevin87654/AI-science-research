"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

/**
 * 顶栏。
 *
 * 导航本体已经移到左侧自动呼出的菜单（`app-shell.tsx`），顶栏只保留
 * 「品牌 + 当前所处功能的编号 + 一句匿名说明 + 一个主行动按钮」，
 * 让背景大图成为视觉主体（参考形态：大图 + 贴边侧栏 + 极简顶栏）。
 */
export function SiteHeader() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => item.href === pathname);

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="科研小助理首页">
        <span className="brand-mark" aria-hidden="true">研</span>
        <span className="brand-text">
          <span>科研小助理</span>
          <span className="brand-sub">Research Copilot</span>
        </span>
      </Link>

      <div className="site-header-right">
        <span className="badge">匿名体验 · 无需注册</span>
        {current ? <span className="crumb">{current.index} / {current.sub}</span> : null}
        {/* 测评页自己就有一个「开始测评」大按钮，顶栏再放一个就成了重复入口 */}
        {pathname === "/assessment" ? null : (
          <Link className="button button-header" href="/assessment">开始测评</Link>
        )}
      </div>
    </header>
  );
}
