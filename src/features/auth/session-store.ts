/**
 * 登录态的本地存储（⚠️ 演示实现，将来换成服务端会话）。
 *
 * 为什么现在放在 localStorage：这一轮只做"入口 + 两个工作台"，登录逻辑由组员接手；
 * 没有服务端登录接口之前，前端需要一个能跨页面、跨刷新记住"我是谁"的地方。
 *
 * **接入真实登录时，这个文件整体删掉**，改为：
 *   · `POST /api/auth/login` 校验密码（服务端哈希）→ 写入 HttpOnly Cookie（`sessions` 表已有）；
 *   · `GET /api/session` 读当前身份（现有 `handleSessionGet` 已经在了，只需把账号绑上去）。
 * 界面调用的三个函数（`signIn` / `signOut` / `useRoleSession`）签名保持不变即可平滑替换。
 *
 * 沿用项目里本地存储的三条纪律：
 * 1. **不是权威数据源**：只用于"刷新后还记得身份"，页面上的数据归属仍以账号 id 为准；
 * 2. **读取一律做结构校验**：localStorage 可能被用户或旧版本写坏，校验不过就当没登录；
 * 3. **隐私模式下无声降级**：存不进去时返回失败原因，由界面提示，不抛异常。
 */
import type { Role, RoleSession } from "@/contracts";
import { verifyCredentials } from "./demo-accounts";

const SESSION_KEY = "research-assistant:role-session:v1";
const SCHEMA_VERSION = "1.0.0";

type Listener = () => void;

export interface StoredSession extends RoleSession {
  schemaVersion: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRole(value: unknown): value is Role {
  return value === "student" || value === "mentor";
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isRole(value.role)) return false;
  if (typeof value.accountId !== "string" || value.accountId.trim().length === 0) return false;
  if (typeof value.name !== "string" || value.name.trim().length === 0) return false;
  if (typeof value.signedInAt !== "string") return false;
  return !Number.isNaN(Date.parse(value.signedInAt));
}

const listeners = new Set<Listener>();

/**
 * 缓存哨兵。必须是 `undefined` 表示"没有缓存" —— 用 `null` 会和"读到的原始值是空"撞车，
 * 退出登录后界面可能还显示上一个账号（`local-session.ts` 里踩过同样的坑）。
 */
let cachedRaw: string | null | undefined;
let cachedSession: StoredSession | null = null;

function readRaw(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function getSessionSnapshot(): StoredSession | null {
  const raw = readRaw();
  if (cachedRaw !== undefined && raw === cachedRaw) return cachedSession;

  cachedRaw = raw;
  cachedSession = null;

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredSession(parsed)) cachedSession = parsed;
    } catch {
      cachedSession = null;
    }
  }

  return cachedSession;
}

/** 服务端渲染时没有 localStorage，一律当作"没登录"。 */
export function getServerSessionSnapshot(): StoredSession | null {
  return null;
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function emitChange(): void {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

export type SignInOutcome =
  | { ok: true; session: StoredSession }
  | { ok: false; message: string };

/**
 * 登录。
 *
 * 目前是**客户端校验**（账号写在 `demo-accounts.ts`）—— 只用于演示，
 * 真实登录必须挪到服务端，原因见该文件头部说明。
 */
export function signIn(role: Role, accountId: string, password: string): SignInOutcome {
  if (accountId.trim().length === 0) {
    return { ok: false, message: role === "student" ? "请输入学号。" : "请输入工号。" };
  }
  if (password.length === 0) {
    return { ok: false, message: "请输入密码。" };
  }

  const account = verifyCredentials(role, accountId, password);
  if (!account) {
    // 故意不区分"账号不存在"与"密码不对"，避免探测账号是否存在。
    return { ok: false, message: "账号或密码不正确，请重试。" };
  }

  const session: StoredSession = {
    schemaVersion: SCHEMA_VERSION,
    accountId: account.id,
    role: account.role,
    name: account.name,
    signedInAt: new Date().toISOString(),
  };

  const store = storage();
  if (!store) {
    return { ok: false, message: "当前浏览器不允许保存登录状态，请关闭无痕模式后重试。" };
  }
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    return { ok: false, message: "保存登录状态失败，请稍后重试。" };
  }

  // 写进 localStorage 之后统一走一次变更广播：同标签页内的订阅者靠它刷新。
  cachedRaw = undefined;
  emitChange();
  return { ok: true, session };
}

export function signOut(): void {
  const store = storage();
  if (store) {
    try {
      store.removeItem(SESSION_KEY);
    } catch {
      /* 清不掉也不影响后续流程 */
    }
  }
  emitChange();
}
