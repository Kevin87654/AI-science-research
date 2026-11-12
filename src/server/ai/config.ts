import "server-only";

/**
 * AI 接入的**配置读取**（B 负责）。
 *
 * 2026-11-12 起改为**直连 OpenAI 兼容的 DeepSeek API**，不再通过
 * `@tencent-ai/agent-sdk` 拉起 CLI 子进程。原因见
 * `docs/新模块文档-大四毕设指导/大四选导师-方向与分工-历史版本.md` §R1：
 * 比赛结束后 CodeBuddy 的 CLI 额度通道已不可用，必须换成自有 API key。
 *
 * 三条约定：
 * 1. 密钥、地址、模型名都只从服务端环境变量读，**绝不进浏览器**；
 * 2. 变量统一用 `SERVER_` 前缀（与数据库配置一致），真实值只放 `.env.local`；
 * 3. 本文件不加载任何 SDK / HTTP 客户端，自检接口只想知道"配没配密钥"时不应该付这个代价。
 */

/** 没有显式配置地址时的默认值。DeepSeek 的 OpenAI 兼容根地址。 */
const DEFAULT_BASE_URL = "https://api.deepseek.com";

/** 没有显式配置模型时的默认值。flash 快且便宜，适合提醒/汇总这类短任务。 */
const DEFAULT_MODEL = "deepseek-flash";

export function resolveAiApiKey(): string {
  return process.env.SERVER_AI_API_KEY?.trim() ?? "";
}

export function isAiConfigured(): boolean {
  return resolveAiApiKey().length > 0;
}

/** 去掉末尾斜杠，避免拼出 `//chat/completions`。 */
export function resolveAiBaseUrl(): string {
  const raw = process.env.SERVER_AI_BASE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export function resolveAiModel(): string {
  const raw = process.env.SERVER_AI_MODEL?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_MODEL;
}

/**
 * 单次调用的超时。
 *
 * 直连 API 没有 CLI 的 13～15 秒固定启动开销，普通短问答实测约 1 秒；
 * 但进度汇总这类要读完整条时间轴的生成任务仍可能到 10～30 秒，
 * 所以默认保留 60 秒，可用 `SERVER_AI_TIMEOUT_MS` 调整。
 */
export function resolveAiTimeoutMs(): number {
  const raw = Number(process.env.SERVER_AI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60_000;
}
