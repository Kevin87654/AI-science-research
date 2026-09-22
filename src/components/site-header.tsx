"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "成长首页" },
  { href: "/assessment", label: "科研测评" },
  { href: "/profile", label: "我的画像" },
  { href: "/roadmap", label: "学习路线" },
  // 下面两项由 C 模块加入（资料与问答页面）。放在路线之后，
  // 因为完整闭环是「测评 → 画像 → 路线 → 找资料 → 提问 → 回首页看进度」。
  { href: "/resources", label: "教师资料" },
  { href: "/questions", label: "科研问答" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header container">
      <Link className="brand" href="/" aria-label="科研小助理首页">
        <span className="brand-mark" aria-hidden="true">研</span>
        科研小助理
      </Link>

      <nav className="site-nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "site-nav-link site-nav-link-active" : "site-nav-link"}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
