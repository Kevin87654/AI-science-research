"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_ITEMS } from "./nav-items";

/**
 * 全站外壳：固定背景大图 + 左侧「鼠标移入自动呼出」的功能菜单。
 *
 * 为什么放在 layout 里：背景与侧栏是**全站唯一**的，页面里再各写一遍必然漂移；
 * 放在这里后，各路由页只管自己的内容（页面里原有的 `<SiteHeader />` 保持不变）。
 *
 * 侧栏的展开方式有三种，都是为了不牺牲可用性：
 * ① 鼠标移入左侧窄栏（桌面主路径，纯 CSS `:hover`）；
 * ② 键盘 Tab 进面板内的链接（`:focus-within`，所以**链接始终在 DOM 里、可聚焦**，不能靠 display 切换）；
 * ③ 点窄栏上的按钮「固定」。触屏没有 hover，第 ③ 条是唯一的入口。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className={isHome ? "backdrop-photo backdrop-photo-home" : "backdrop-photo backdrop-photo-page"} />
        <div className="backdrop-glow" />
        <div className="backdrop-grid" />
        <div className="backdrop-veil" />
      </div>

      <aside className={pinned ? "dock dock-is-pinned" : "dock"} aria-label="功能菜单">
        {/*
          遮罩默认 pointer-events: none —— 否则鼠标横扫页面时会一直停在 `.dock:hover` 上，
          菜单再也关不掉。只有「已固定」时才接收点击，让触屏用户点空白处就能收起。
          tabIndex=-1：键盘关闭走 Esc，不把这个全屏热区塞进 Tab 顺序。
        */}
        <button
          type="button"
          tabIndex={-1}
          className="dock-scrim"
          aria-label="收起功能菜单"
          onClick={() => setPinned(false)}
        />

        <div className="dock-rail">
          <button
            type="button"
            className="dock-handle"
            aria-expanded={pinned}
            aria-label={pinned ? "收起功能菜单" : "展开功能菜单"}
            onClick={() => setPinned((value) => !value)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="dock-rail-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="dock-rail-hint" aria-hidden="true">菜单</span>
        </div>

        <div className="dock-panel">
          <Link className="dock-brand" href="/" aria-label="科研小助理首页">
            <span className="dock-brand-mark" aria-hidden="true">研</span>
            <span>
              <span className="dock-brand-name">科研小助理</span>
              <span className="dock-brand-sub">Research Copilot</span>
            </span>
          </Link>

          <nav className="dock-nav" aria-label="功能导航">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "dock-item dock-item-active" : "dock-item"}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="dock-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="dock-item-label">{item.label}</span>
                  <span className="dock-item-index" aria-hidden="true">{item.index}</span>
                </Link>
              );
            })}
          </nav>

          <div className="dock-foot">
            <p>匿名体验 · 不收集姓名、学号与手机号</p>
            <button
              type="button"
              className={pinned ? "dock-pin dock-pin-on" : "dock-pin"}
              aria-pressed={pinned}
              onClick={() => setPinned((value) => !value)}
            >
              {pinned ? "已固定 · 点击收起" : "固定菜单"}
            </button>
          </div>
        </div>
      </aside>

      <div className="page-shell">{children}</div>
    </>
  );
}
