/**
 * Cookie 解析与序列化（服务端专用）。
 *
 * 不引入第三方依赖：本机没有可用的包管理器，而这里只需要 RFC 6265 的一个最小子集。
 * 该文件**不导入任何其他运行时模块**，因此可以被 Node 自带测试直接运行。
 */

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  /** 只在 HTTPS 下发送。Vercel 上为 true；本地 http 开发时为 false。 */
  secure: boolean;
  maxAgeSeconds: number;
}

/**
 * 解析 `Cookie` 请求头。
 * 只做必要的健壮性处理：跳过缺名/空名的片段、去掉包裹引号、值里允许出现 `=`。
 */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const segment of header.split(";")) {
    const eq = segment.indexOf("=");
    if (eq < 1) continue;
    const name = segment.slice(0, eq).trim();
    if (!name) continue;
    let value = segment.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }

  return out;
}

function sameSiteLabel(value: CookieOptions["sameSite"]): string {
  if (value === "lax") return "Lax";
  if (value === "strict") return "Strict";
  return "None";
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `SameSite=${sameSiteLabel(options.sameSite)}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

/** 立刻过期，用于登出或清理无效会话。 */
export function serializeClearedCookie(name: string, options: CookieOptions): string {
  return serializeCookie(name, "", { ...options, maxAgeSeconds: 0 });
}
