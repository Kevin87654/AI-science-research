import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // CodeBuddy Agent SDK 会 spawn 自带 CLI 子进程，**不能被打包进 bundle**，
  // 否则解析不到 CLI 路径。这两行来自 `agent-vercel-probe` 的实测结论，缺一不可。
  serverExternalPackages: ["@tencent-ai/agent-sdk"],

  // 把 SDK 的 cli/ 目录（内含各平台二进制）一起带进函数包。
  // 若哪天线上报 "resolvedCliPath 为空"，先看这里是不是被平台裁剪了。
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@tencent-ai/agent-sdk/**/*"],
  },
};

export default nextConfig;
