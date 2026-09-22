/**
 * 全站导航项的唯一来源。
 *
 * 左侧自动呼出菜单（`app-shell.tsx`）与顶栏（`site-header.tsx`）都从这里取，
 * 避免两处维护同一份列表导致漂移。顺序即完整闭环：
 * 成长首页 → 科研测评 → 我的画像 → 学习路线 → 教师资料 → 科研问答。
 */
export type NavItem = {
  href: string;
  label: string;
  /** 侧栏里的英文副标题，纯装饰 */
  sub: string;
  /** 编号，纯装饰（01…06） */
  index: string;
  icon: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "成长首页",
    sub: "Overview",
    index: "01",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 10v9h12v-9" />
        <path d="M10 19v-5h4v5" />
      </svg>
    ),
  },
  {
    href: "/assessment",
    label: "科研测评",
    sub: "Assessment",
    index: "02",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "我的画像",
    sub: "Profile",
    index: "03",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
    ),
  },
  {
    href: "/roadmap",
    label: "学习路线",
    sub: "Roadmap",
    index: "04",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M5 19V8.5A3.5 3.5 0 0 1 8.5 5H13" />
        <path d="M15.5 3 19 5.5 15.5 8" />
        <circle cx="5" cy="20" r="1.6" />
        <circle cx="16" cy="14" r="1.6" />
        <path d="M16 15.6V18a3 3 0 0 1-3 3H8" />
      </svg>
    ),
  },
  {
    href: "/resources",
    label: "教师资料",
    sub: "Faculty",
    index: "05",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v13H6.5A2.5 2.5 0 0 0 4 19.5z" />
        <path d="M8 8h7M8 11.5h5" />
      </svg>
    ),
  },
  {
    href: "/questions",
    label: "科研问答",
    sub: "Q&A",
    index: "06",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
        <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 0 1-2.6-.35L5 20.5l.9-3.2A6.6 6.6 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5z" />
        <path d="M10 11.5h4M12 9.5v4" />
      </svg>
    ),
  },
];
