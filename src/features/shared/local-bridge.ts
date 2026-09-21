/**
 * 临时本地桥接（B 负责）—— ⚠️ **明确标记为过渡方案，等 A 提供接口后替换。**
 *
 * 现状：本轮唯一落地到数据库的用户数据是**任务进度**（`progress.ts`，A 负责）。
 * 测评提交、画像、路线暂时没有服务端接口，而 PRD §10.6 要求"页面刷新后进度仍然保留"、
 * §11.3 要求首页能显示上一次的结果——所以先存在浏览器本地，让第一条流程能跑通。
 *
 * 三条纪律：
 * 1. **它不是权威数据源**：任务进度一律以服务端 `/api/progress` 为准，这里不存进度。
 * 2. **演示数据必须带标记**：`isDemo` 随流程一起存，界面据此显示"演示数据"角标。
 * 3. **读取一律做结构校验**：localStorage 的内容可被用户或旧版本写坏，
 *    校验不过就当没有，绝不让脏数据流进界面。
 */
import type { AssessmentSubmission, Profile, Roadmap } from "@/contracts";

const STORAGE_KEY = "research-assistant:flow:v1";
const SCHEMA_VERSION = "1.0.0";

export type LocalFlow = {
  schemaVersion: string;
  savedAt: string;
  isDemo: boolean;
  submission: AssessmentSubmission;
  profile: Profile;
  /** 用户还没点"生成学习路线"时为 `null`。 */
  roadmap: Roadmap | null;
};

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * 订阅机制：让 React 用 `useSyncExternalStore` 读这份外部状态。
 *
 * 为什么不直接在 `useEffect` 里 `setState(loadFlow())`：
 * 那属于"在副作用里同步改状态"，会触发级联渲染，React 的新 lint 规则直接报错。
 * `useSyncExternalStore` 本来就是为"订阅 React 之外的状态"设计的，项目也用它。
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let cachedRaw: string | null = null;
let cachedFlow: LocalFlow | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 只校验到"能安全使用"的程度：版本、关键对象存在、profile 有 id。 */
function isLocalFlow(value: unknown): value is LocalFlow {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isRecord(value.submission)) return false;
  if (!isRecord(value.profile)) return false;
  if (typeof (value.profile as Record<string, unknown>).id !== "string") return false;
  if (value.roadmap !== null && !isRecord(value.roadmap)) return false;
  return true;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // 隐私模式等场景下访问 localStorage 会直接抛错。
    return null;
  }
}

function readRaw(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * 当前快照。
 *
 * ⚠️ **必须保持引用稳定**：内容没变时要返回同一个对象，
 * 否则 `useSyncExternalStore` 会因为"每次快照都不同"而无限重渲染。
 * 所以这里按原始字符串做一层缓存。
 */
export function getFlowSnapshot(): LocalFlow | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedFlow;

  cachedRaw = raw;
  cachedFlow = null;

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isLocalFlow(parsed)) cachedFlow = parsed;
    } catch {
      cachedFlow = null;
    }
  }

  return cachedFlow;
}

/** 服务端渲染时没有 localStorage，一律当作"还没有数据"。 */
export function getServerFlowSnapshot(): LocalFlow | null {
  return null;
}

export function subscribeFlow(listener: Listener): () => void {
  listeners.add(listener);

  // 同标签页内的写入不会触发 storage 事件，所以 saveFlow/clearFlow 要自己广播；
  // 跨标签页的改动则靠 storage 事件。
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function emitChange(): void {
  cachedRaw = null;
  for (const listener of listeners) listener();
}

export function loadFlow(): LocalFlow | null {
  return getFlowSnapshot();
}

export function saveFlow(flow: LocalFlow): SaveResult {
  const store = storage();
  if (!store) return { ok: false, message: "当前浏览器不允许保存本地数据，本次结果在刷新后会丢失。" };

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(flow));
    emitChange();
    return { ok: true };
  } catch {
    return { ok: false, message: "浏览器存储空间不足，本次结果在刷新后会丢失。" };
  }
}

export function clearFlow(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
    emitChange();
  } catch {
    // 清不掉就算了：它只是缓存，不是权威数据。
  }
}

export function buildFlow(input: {
  submission: AssessmentSubmission;
  profile: Profile;
  roadmap: Roadmap | null;
  savedAt: string;
  isDemo: boolean;
}): LocalFlow {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: input.savedAt,
    isDemo: input.isDemo,
    submission: input.submission,
    profile: input.profile,
    roadmap: input.roadmap,
  };
}
