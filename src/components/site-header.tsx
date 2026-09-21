"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "成长首页" },
  { href: "/assessment", label: "科研测评" },
  { href: "/profile", label: "我的画像" },
  { href: "/roadmap", label: "学习路线" },
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
