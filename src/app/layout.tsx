import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "科研小助理", template: "%s · 科研小助理" },
  description: "从认识科研，到迈出第一步。面向大学新生的科研启蒙与成长助手。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">跳到正文</a>
        {children}
      </body>
    </html>
  );
}
