"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoLockup, LogoMark } from "./logo";
import { CONTACT_LINK, NAV_ITEMS } from "./nav-items";

/**
 * 全站外壳：固定背景层 + 左侧常驻图标栏（鼠标移入展开成带文字的面板）。
 *
 * 为什么要"常驻图标"：收起时只留一条 16px 细线的做法让功能完全不可发现 ——
 * 参考形态（终末地官网）是**图标一直可见**，鼠标移入才补上文字标签。
 *
 * 三种展开方式，都是为了不牺牲可用性：
 * ① 鼠标移入左栏（桌面主路径，纯 CSS `:hover`）；
 * ② 键盘 Tab 进面板内的链接（`:focus-within`，所以**链接始终在 DOM 里、可聚焦**，不能靠 display 切换）；
 * ③ 点左栏底部的按钮「固定」（触屏没有 hover，这是唯一入口）。
 *
 * 图标栏那一组链接是 `aria-hidden` + `tabIndex={-1}`：它们只是同一批目的地的视觉副本，
 * 让读屏重复念两遍导航是噪音；可访问的那一份在展开面板里。
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
          <Link className="dock-rail-logo" href="/" aria-label="科研小助理首页">
            <LogoMark size={42} />
          </Link>

          <nav className="dock-rail-nav" aria-hidden="true">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  tabIndex={-1}
                  className={active ? "dock-rail-item dock-rail-item-active" : "dock-rail-item"}
                  title={item.label}
                >
                  {item.icon}
                </Link>
              );
            })}
          </nav>

          {/* 底部：对外联系方式 + 展开按钮。整块贴底，中间的空白留给上方那列图标 */}
          <div className="dock-rail-bottom">
            <a
              className="dock-rail-item"
              href={CONTACT_LINK.href}
              target="_blank"
              rel="noreferrer noopener"
              tabIndex={-1}
              aria-hidden="true"
              title={CONTACT_LINK.label}
            >
              {CONTACT_LINK.icon}
            </a>

            <button
              type="button"
              className="dock-handle"
              aria-expanded={pinned}
              aria-label={pinned ? "收起功能菜单" : "展开功能菜单"}
              onClick={() => setPinned((value) => !value)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="dock-panel">
          <Link className="dock-brand" href="/" aria-label="科研小助理首页">
            <LogoLockup size={42} />
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

          <div className="dock-contact-wrap">
            <a
              className="dock-item dock-contact"
              href={CONTACT_LINK.href}
              target="_blank"
              rel="noreferrer noopener"
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
