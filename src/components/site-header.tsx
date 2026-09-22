"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

/**
 * 顶栏。
 *
 * 品牌区的 logo 已经在左侧图标栏顶部（和参考站一样把 logo 放在侧栏），
 * 这里只放「当前所处的功能」+ 一句说明 + 一个主行动按钮，避免同一屏出现两个 logo。
 */
export function SiteHeader() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => item.href === pathname);

  return (
    <header className="site-header">
      <div className="header-context">
        {current ? (
          <>
            <span className="crumb">{current.index} / {current.sub}</span>
            <span className="header-label">{current.label}</span>
          </>
        ) : (
          <span className="header-tagline">从认识科研，到迈出第一步</span>
        )}
      </div>

      <div className="site-header-right">
        <span className="badge">匿名体验 · 无需注册</span>
        {/* 测评页自己就有一个「开始测评」大按钮，顶栏再放一个就成了重复入口 */}
        {pathname === "/assessment" ? null : (
          <Link className="button button-header" href="/assessment">开始测评</Link>
        )}
      </div>
    </header>
  );
}
