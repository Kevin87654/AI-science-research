"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoMark } from "./logo";
import { CONTACT_LINK, NAV_ITEMS } from "./nav-items";

/**
 * 全站外壳：固定背景层 + 左侧**一列**菜单。
 *
 * 这一列的形态（重要，别改回两套）：
 * 收起时 72px 宽、只露图标；鼠标移入 / 键盘聚焦 / 点「固定」→ **同一列变宽**到 292px，
 * 文字从图标右侧长出来。**不存在"图标栏 + 面板"两套并排** —— 那样展开后同一批选项会出现两列。
 *
 * 三种展开方式都是为了不牺牲可用性：
 * ① 鼠标移入左栏（桌面主路径，纯 CSS `:hover`）；
 * ② 键盘 Tab 进来（`:focus-within`）—— 链接始终在 DOM 中、可聚焦，不能靠 display 切换；
 * ③ 点底部的「展开菜单」按钮（触屏没有 hover，这是唯一入口；面板里的「固定菜单」是同一个开关）。
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
        <div className="dock-inner">
          <Link className="dock-brand" href="/" aria-label="科研小助理首页">
            <span className="dock-brand-mark">
              <LogoMark size={44} />
            </span>
            <span className="dock-brand-text">
              <span className="dock-brand-name">科研小助理</span>
              <span className="dock-brand-sub">RESEARCH COPILOT</span>
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
                  /* 收起时文字被裁掉，靠原生 tooltip 补一下可发现性 */
                  title={item.label}
                >
                  <span className="dock-item-icon" aria-hidden="true">{item.icon}</span>
                  <span className="dock-item-label">{item.label}</span>
                  <span className="dock-item-index" aria-hidden="true">{item.index}</span>
                </Link>
              );
            })}
          </nav>

          <div className="dock-contact-wrap">
            <a
              className="dock-item"
              href={CONTACT_LINK.href}
              target="_blank"
              rel="noreferrer noopener"
              title={CONTACT_LINK.label}
            >
              <span className="dock-item-icon" aria-hidden="true">{CONTACT_LINK.icon}</span>
              <span className="dock-item-label dock-item-stack">
                <span>{CONTACT_LINK.label}</span>
                <span className="dock-item-note">{CONTACT_LINK.note}</span>
              </span>
              <span className="dock-item-index" aria-hidden="true">&#8599;</span>
            </a>
          </div>

          <div className="dock-foot">
            <p>匿名体验 · 不收集个人信息</p>
            <button
              type="button"
              className={pinned ? "dock-pin dock-pin-on" : "dock-pin"}
              aria-pressed={pinned}
              onClick={() => setPinned((value) => !value)}
            >
              {pinned ? "已固定 · 点击收起" : "固定菜单"}
            </button>
          </div>

          <button
            type="button"
            className="dock-handle"
            aria-expanded={pinned}
            aria-label={pinned ? "收起功能菜单" : "展开功能菜单"}
            onClick={() => setPinned((value) => !value)}
          >
            <span className="dock-handle-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </span>
            <span>{pinned ? "已固定" : "展开菜单"}</span>
          </button>
        </div>
      </aside>

      <div className="page-shell">{children}</div>
    </>
  );
}
