"use client";

/**
 * 学生端的左侧图标栏（与全站图标栏同一套形态：收起 72px、移入展开、选中项左侧 3px 黑条）。
 *
 * 为什么放在学生页里、而不是塞进 `app-shell.tsx`：
 * 这里的两个选项**不是路由**，是同一页里的视图切换（毕设时间轴 / 联系导师），
 * 状态必须和页面内容共享。放进外壳就要把状态提到外壳或用 URL 参数，
 * 前者让外壳变成业务组件，后者让一个纯视图切换产生可被收藏的历史记录 —— 都不划算。
 *
 * 2026-11-12：原来的「我的毕设进度」与「学院毕设节点」合并成一块流态旋转时间轴
 * （左半边我的进度、右半边学院节点），侧栏因此从三项收成两项。
 *
 * 视觉沿用首页那套：logo 在顶部、选项一列、底部留一个"返回身份选择"的出口。
 */
import Link from "next/link";

import { LogoMark } from "@/components/logo";

/** `timeline` = 双轨时间轴（我的进度 + 学院节点）；`contact` = 联系导师。 */
export type StudentView = "timeline" | "contact";

const TABS: readonly { key: StudentView; label: string; icon: React.ReactNode }[] = [
  {
    key: "timeline",
    label: "毕设时间轴",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3.5v17" />
        <circle cx="7" cy="7" r="1.4" />
        <circle cx="7" cy="12" r="1.4" />
        <circle cx="7" cy="17" r="1.4" />
        <path d="M11.5 7H19M11.5 12H19M11.5 17H16" />
      </svg>
    ),
  },
  {
    key: "contact",
    label: "联系导师",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-4 3.5V16H4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    ),
  },
];

export function StudentDock({
  value,
  onChange,
}: {
  value: StudentView;
  onChange: (next: StudentView) => void;
}) {
  return (
    <aside className="dock dock-student" aria-label="学生工作台视图">
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

        <nav className="dock-nav dock-nav-tabs" aria-label="选择学生工作台视图">
          {TABS.map((tab) => {
            const active = tab.key === value;
            return (
              <button
                key={tab.key}
                className={active ? "dock-item dock-item-button dock-item-active" : "dock-item dock-item-button"}
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={active ? "true" : undefined}
                /* 收起时文字被裁掉，靠原生 tooltip 补一下可发现性 */
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
