import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header container">
      <Link className="brand" href="/" aria-label="科研小助理首页">
        <span className="brand-mark" aria-hidden="true">研</span>
        科研小助理
      </Link>
      <span className="badge">初版建设中</span>
    </header>
  );
}
