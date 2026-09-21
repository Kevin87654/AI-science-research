import "server-only";

/**
 * AI 接入的**配置读取**（B 负责）。
 *
 * 单独一个文件是有意的：`codebuddy.ts` 顶部会 import SDK，而 SDK 会去解析自带的 CLI 路径。
 * 让自检接口这类地方只想知道"配没配密钥"时，不应该因此把整个 SDK 加载进来。
 */

export function isAiConfigured(): boolean {
  return Boolean(process.env.SERVER_CODEBUDDY_API_KEY?.trim());
}

/**
 * 组装给 SDK 的环境变量。
 *
 * SDK 只认 `CODEBUDDY_*`，工程统一用 `SERVER_` 前缀 —— 映射放在这里，
 * 这样别处不需要知道 SDK 的变量名，密钥也不会散到多个文件。
 */
export function buildCodebuddyEnv(): Record<string, string> {
  const env: Record<string, string> = {
    CODEBUDDY_API_KEY: process.env.SERVER_CODEBUDDY_API_KEY?.trim() ?? "",
    // 国内版（workbuddy.cn）必须设为 internal；国际版不要设置这一项。
    CODEBUDDY_INTERNET_ENVIRONMENT: process.env.SERVER_CODEBUDDY_ENVIRONMENT?.trim() || "internal",
  };

  // Vercel 上没有可写的 home，CLI 会往那里写配置。探针实测 home 目录 "not-exist"。
  if (process.env.VERCEL) {
    env.HOME = "/tmp";
    env.TMPDIR = "/tmp";
    env.XDG_CONFIG_HOME = "/tmp/.config";
  }

  return env;
}

/**
 * 单次调用的超时。
 *
 * ⚠️ **实测数据（本机，2026-09-21）**：一次调用耗时主要是 CLI 子进程的固定启动开销
 * （约 13～15 秒，与提问长短无关），再加模型生成，带 JSON 约束的提问约 **25～45 秒**。
 * 所以 20 秒是**不够用的** —— 之前就是因为超时太短导致每次都被中途截断、取不到文本，
 * 而表面上只表现为"AI 从不接管"。可用 `SERVER_AI_TIMEOUT_MS` 调整。
 */
export function resolveAiTimeoutMs(): number {
  const raw = Number(process.env.SERVER_AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000;
}
