"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="container status-page"><h1>页面暂时没能打开</h1><p>请重试一次。如果仍无法打开，可以稍后再来。</p><button className="button" onClick={reset}>重新尝试</button></main>;
}
