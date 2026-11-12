"use client";

/**
 * 学生端的左侧图标栏（与全站图标栏同一套形态：收起 72px、移入展开、选中项左侧 3px 黑条）。
 *
 * 为什么放在学生页里、而不是塞进 `app-shell.tsx`：
 * 这里的选项**不是路由**，是同一页里的视图切换，状态必须和页面内容共享。
 * 放进外壳就要把状态提到外壳或用 URL 参数，前者让外壳变成业务组件，
 * 后者让一个纯视图切换产生可被收藏的历史记录 —— 都不划算。
 *
 * 2026-11-12：原来的「我的毕设进度」与「学院毕设节点」合并成一块流态旋转时间轴
 * （左半边我的进度、右半边学院节点）。
 *
 * 2026-11-12 追加：「兴趣课题探测」「导师资料问答」两个后续开发入口。
 * 它们只有入口与范围说明，功能没有实现 —— 侧栏用「待开发」标签标出来。
 */
import Link from "next/link";

import { LogoMark } from "@/components/logo";

/** `timeline` = 双轨时间轴；`interest` / `mentor-rag` = 待开发入口；`contact` = 联系导师。 */
export type StudentView = "timeline" | "interest" | "mentor-rag" | "contact";

const TABS: readonly { key: StudentView; label: string; soon?: boolean; icon: React.ReactNode }[] = [
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
    key: "interest",
    label: "兴趣课题探测",
    soon: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M15.2 8.8l-2 4.4-4.4 2 2-4.4z" />
      </svg>
    ),
  },
  {
    key: "mentor-rag",
    label: "导师资料问答",
    soon: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4.5h9M5 8.5h9M5 12.5h4.5" />
        <circle cx="15.5" cy="15" r="3.4" />
        <path d="M18 17.5L20 19.8" />
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
            const className = [
              "dock-item",
              "dock-item-button",
              active ? "dock-item-active" : "",
              tab.soon ? "dock-item-soon-entry" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={tab.key}
                className={className}
                type="button"
                onClick={() => onChange(tab.key)}
                aria-current={active ? "true" : undefined}
                /* 收起时文字被裁掉，靠原生 tooltip 补一下可发现性 */
                title={tab.soon ? `${tab.label}（待开发）` : tab.label}
              >
                <span className="dock-item-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="dock-item-label">{tab.label}</span>
                {tab.soon ? <span className="dock-item-soon">待开发</span> : null}
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
