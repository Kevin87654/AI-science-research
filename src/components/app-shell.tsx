"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoMark } from "./logo";
import { CONTACT_LINK, NAV_ITEMS } from "./nav-items";

/**
 * 全站外壳：固定背景层 + 左侧**一列**菜单。
 *
 * 这一列的形态（重要，别改回两套）：
 * 收起时 72px 宽、只露图标；鼠标移入 / 键盘聚焦 → **同一列变宽**到 292px，
 * 文字从图标右侧长出来。**不存在"图标栏 + 面板"两套并排** —— 那样展开后同一批选项会出现两列。
 *
 * 展开方式只剩两种（按用户要求去掉了「固定菜单 / 展开菜单」按钮）：
 * ① 鼠标移入左栏（纯 CSS `:hover`）；
 * ② 键盘 Tab 进来（`:focus-within`）—— 链接始终在 DOM 中、可聚焦，不能靠 display 切换。
 * ⚠️ 触屏没有 hover，去掉那两个按钮后移动端就没有展开入口了（已知代价，用户明确要求）。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <div className={isHome ? "backdrop-photo backdrop-photo-home" : "backdrop-photo backdrop-photo-page"} />
        <div className="backdrop-glow" />
        <div className="backdrop-grid" />
        <div className="backdrop-veil" />
      </div>

      <aside className="dock" aria-label="功能菜单">
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
                </Link>
              );
            })}
          </nav>

          {/* 对外联系方式：菜单最下方（`margin-top: auto` 把它压到底部） */}
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
        </div>
      </aside>

      <div className="page-shell">{children}</div>
    </>
  );
}
