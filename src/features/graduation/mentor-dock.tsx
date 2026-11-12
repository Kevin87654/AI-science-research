"use client";

/**
 * 导师端的左侧图标栏。
 *
 * 与学生端同一套形态（收起 72px、移入展开、选中项左侧 3px 黑条），
 * 但导师只有两个视角：看学生进度 / 联系学生。它们不是路由，而是同页视图切换，
 * 所以和 `StudentDock` 一样放在页面里，不塞进全站外壳。
 */
import Link from "next/link";

import { LogoMark } from "@/components/logo";

/** `progress` = 学生进度；`contact` = 联系学生。 */
export type MentorView = "progress" | "contact";

const TABS: readonly { key: MentorView; label: string; icon: React.ReactNode }[] = [
  {
    key: "progress",
    label: "学生进度",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
        <path d="M16 7h5M16 11h5M16 15h3" />
      </svg>
    ),
  },
  {
    key: "contact",
    label: "联系学生",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-4 3.5V16H4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    ),
  },
];

export function MentorDock({
  value,
  onChange,
}: {
  value: MentorView;
  onChange: (next: MentorView) => void;
}) {
  return (
    <aside className="dock" aria-label="导师工作台视图">
      <div className="dock-inner">
        <Link className="dock-brand" href="/" aria-label="返回身份选择">
          <span className="dock-brand-mark">
            <LogoMark size={44} />
          </span>
          <span className="dock-brand-text">
            <span className="dock-brand-name">科研小助理</span>
            <span className="dock-brand-sub">RESEARCH COPILOT</span>
          </span>
        </Link>

        <nav className="dock-nav dock-nav-tabs" aria-label="选择导师视图">
          {TABS.map((tab) => {
            const active = tab.key === value;
            return (
              <button
                key={tab.key}
                className={active ? "dock-item dock-item-button dock-item-active" : "dock-item dock-item-button"}
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={active ? "true" : undefined}
                title={tab.label}
              >
                <span className="dock-item-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="dock-item-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="dock-contact-wrap">
          <Link className="dock-item dock-item-button" href="/" title="返回身份选择">
            <span className="dock-item-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 6l-6 6 6 6" />
              </svg>
            </span>
            <span className="dock-item-label">身份选择</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
