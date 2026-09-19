import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return <><SiteHeader /><main id="main-content" className="container status-page"><h1>这个页面还没有找到</h1><p>链接可能已变更，你可以回到首页继续浏览。</p><Link className="button" href="/">返回首页</Link></main></>;
}
