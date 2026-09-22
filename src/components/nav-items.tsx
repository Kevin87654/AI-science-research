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

export type ContactLink = {
  href: string;
  label: string;
  /** 副标题，用来告诉用户点出去会到哪里 */
  note: string;
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

/**
 * 侧栏最下方的对外联系方式。不是一个站内页面，所以不放进 NAV_ITEMS：
 * 它没有"当前选中"的概念，也不该被算进编号里。
 */
export const CONTACT_LINK: ContactLink = {
  href: "https://github.com/Kevin87654/AI-science-research",
  label: "Contact us",
  note: "GitHub · 公开仓库",
  icon: (
    /* GitHub 标记是实心路径（不是描边），所以单独写、不加 stroke 属性 */
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.5 9.5 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.48A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
      <path d="M6.9 13.7c-.02.05-.1.07-.17.03-.08-.03-.12-.1-.1-.15.02-.05.1-.07.17-.03.08.03.12.1.1.15zM7.3 14.2c-.05.04-.14.02-.2-.04-.06-.06-.07-.15-.02-.19.05-.04.14-.02.2.04.06.06.07.15.02.19zM7.9 14.9c-.06.05-.16.01-.22-.08-.06-.09-.06-.19 0-.24.06-.05.16-.01.22.08.06.09.06.19 0 .24zM8.6 15.5c-.05.05-.16.02-.24-.07-.08-.09-.1-.2-.05-.25.06-.05.17-.02.24.07.09.09.11.2.05.25zM9.6 15.9c-.02.06-.13.09-.24.06-.11-.03-.19-.11-.17-.17.02-.06.13-.09.24-.06.11.03.19.11.17.17zM10.7 15.9c0 .07-.1.13-.22.13-.12 0-.22-.06-.22-.13 0-.07.1-.13.22-.13.12 0 .22.06.22.13zM11.6 15.8c.01.07-.09.14-.21.15-.12.02-.23-.03-.24-.1-.01-.07.09-.13.21-.15.12-.02.22.03.24.1z" />
    </svg>
  ),
};
