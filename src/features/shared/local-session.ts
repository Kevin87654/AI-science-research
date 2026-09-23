/**
 * 「过程草稿」的本地存储（PRD §4.6 的 C1 / C2，fodenspider 负责）。
 *
 * **为什么需要**：免注册是这个产品的前提，代价是所有状态都放在组件里 ——
 * 用户等 15～30 秒拿到一条问答、或答到一半的测评，**切个页面或刷新一下全没了**。
 * 这不是"体验优化"，是真实的数据丢失。
 *
 * **与 `local-bridge.ts` 的分工**：那个存**流程结果**（提交 / 画像 / 路线），
 * 这个存**过程草稿**（最近一次问答、没答完的测评）。两者的生命周期不同 ——
 * 结果要长期留着，草稿用完就该清掉 —— 所以分开存、分开清，互不影响。
 *
 * 沿用同样的三条纪律：
 * 1. **不是权威数据源**：只服务"接着上次继续"这一件事，界面上的判断不依赖它。
 * 2. **读取一律做结构校验**：localStorage 可被用户或旧版本写坏，校验不过就当没有，
 *    绝不让脏数据流进界面。
 * 3. **隐私模式下无声降级**：不允许保存时返回失败（界面决定怎么提示），不抛异常。
 */
import type { AssessmentAnswer, AssessmentMode, AssessmentQuestion, QuestionResult } from "@/contracts";

const QA_KEY = "research-assistant:qa-last:v1";
const DRAFT_KEY = "research-assistant:assessment-draft:v1";
const SCHEMA_VERSION = "1.0.0";

/**
 * 草稿保留 7 天。
 *
 * 再久的草稿用户自己都忘了，界面上还问一句"要不要接着上次答"反而是打扰；
 * 而问答结果更短命，一周也够 —— 它本来就是"回来还能看到刚才那条"。
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Listener = () => void;

export type SaveOutcome = { ok: true } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

/** 记录里必须有的通用字段：版本与保存时间。 */
function hasHeader(value: Record<string, unknown>): boolean {
  return value.schemaVersion === SCHEMA_VERSION && typeof value.savedAt === "string";
}

function isFresh(value: { savedAt: string }): boolean {
  const savedAt = Date.parse(value.savedAt);
  if (Number.isNaN(savedAt)) return false;
  return Date.now() - savedAt <= MAX_AGE_MS;
}

/* ------------------------------------------------------------------ */
/* 通用的一小份 store                                                  */
/* ------------------------------------------------------------------ */

/**
 * `useSyncExternalStore` 要求快照**引用稳定**（内容没变必须返回同一个对象），
 * 否则会无限重渲染 —— 所以这里按原始字符串缓存一层，和 `local-bridge` 同一做法。
 */
function createStore<T extends { savedAt: string }>(
  key: string,
  validate: (value: unknown) => value is T,
) {
  const listeners = new Set<Listener>();
  /**
   * 缓存哨兵。
   *
   * ⚠️ **这里必须是 `undefined`（= 没有缓存），不能用 `null`。**
   * `null` 同时表示"读到的原始值是空"，两者撞在一起会出真事故：
   * 清空存储时 `emitChange()` 把哨兵设成 `null`，而清空后 `readRaw()` 也返回 `null`，
   * 于是 `raw === cachedRaw` 短路成立，**返回的还是清空之前那份过期数据** ——
   * 界面上表现为"草稿已经删了，但提示还挂在那里"。
   * （本轮实测抓到过：点「重新开始」后 localStorage 已空，提示却还在。）
   */
  let cachedRaw: string | null | undefined;
  let cachedValue: T | null = null;

  function readRaw(): string | null {
    const store = storage();
    if (!store) return null;
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  }

  function getSnapshot(): T | null {
    const raw = readRaw();
    if (cachedRaw !== undefined && raw === cachedRaw) return cachedValue;

    cachedRaw = raw;
    cachedValue = null;

    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        // 过期不算错，只当作"没有" —— 不必清掉，下次写入自然覆盖。
        if (validate(parsed) && isFresh(parsed)) cachedValue = parsed;
      } catch {
        cachedValue = null;
      }
    }

    return cachedValue;
  }

  /** 服务端渲染时没有 localStorage，一律当作"还没有数据"。 */
  function getServerSnapshot(): T | null {
    return null;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    // 同标签页内的写入不会触发 storage 事件，所以 save/clear 要自己广播；
    // 跨标签页的改动则靠 storage 事件。
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  function emitChange(): void {
    // 设回 `undefined` 而不是 `null` —— 见 `cachedRaw` 上面的说明。
    cachedRaw = undefined;
    for (const listener of listeners) listener();
  }

  function save(value: T): SaveOutcome {
    const store = storage();
    if (!store) {
      return { ok: false, message: "当前浏览器不允许保存本地数据，这一份在刷新后会丢失。" };
    }
    try {
      store.setItem(key, JSON.stringify(value));
      emitChange();
      return { ok: true };
    } catch {
      // 配额满或被策略拦下：不让它影响主流程。
      return { ok: false, message: "保存本地数据失败，这一份在刷新后会丢失。" };
    }
  }

  function clear(): void {
    const store = storage();
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      /* 清不掉也不影响主流程 */
    }
    emitChange();
  }

  return { getSnapshot, getServerSnapshot, subscribe, save, clear };
}

/* ------------------------------------------------------------------ */
/* C2：最近一次问答                                                    */
/* ------------------------------------------------------------------ */

export type QaLast = {
  schemaVersion: string;
  savedAt: string;
  /** 用户实际提交的那一句，恢复时连它一起还回来。 */
  question: string;
  result: QuestionResult;
};

function isQaLast(value: unknown): value is QaLast {
  if (!isRecord(value) || !hasHeader(value)) return false;
  if (typeof value.question !== "string" || value.question.trim().length === 0) return false;
  if (!isRecord(value.result)) return false;
  if (!isRecord(value.result.answer)) return false;
  if (value.result.decidedBy !== "rules" && value.result.decidedBy !== "ai") return false;
  return true;
}

const qaStore = createStore<QaLast>(QA_KEY, isQaLast);

export const getQaLastSnapshot = qaStore.getSnapshot;
export const getQaLastServerSnapshot = qaStore.getServerSnapshot;
export const subscribeQaLast = qaStore.subscribe;

/** 记下最近一次问答。失败只返回 message，由界面决定要不要提示。 */
export function saveQaLast(question: string, result: QuestionResult): SaveOutcome {
  return qaStore.save({
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    question,
    result,
  });
}

export function clearQaLast(): void {
  qaStore.clear();
}

/* ------------------------------------------------------------------ */
/* C1：没答完的测评                                                    */
/* ------------------------------------------------------------------ */

/**
 * 草稿里的一步。
 *
 * 与 `assessment-form.tsx` 里那个只在内存里用的 `StepItem` 字段完全一致 ——
 * 结构相同，所以可以直接互相赋值。放这里定义是为了让存储层不必反向依赖组件。
 */
export type AssessmentDraftStep = {
  question: AssessmentQuestion;
  probe: string | null;
  reason: string;
  answer: AssessmentAnswer | null;
};

export type AssessmentDraft = {
  schemaVersion: string;
  savedAt: string;
  mode: AssessmentMode;
  steps: AssessmentDraftStep[];
  cursor: number;
  /** 出题已退回规则模式（AI 不可用）。恢复时要一起还回来，否则界面会显示错的说明。 */
  basicMode: boolean;
};

function isDraftStep(value: unknown): value is AssessmentDraftStep {
  if (!isRecord(value)) return false;
  if (!isRecord(value.question)) return false;
  if (typeof value.question.id !== "string") return false;
  if (typeof value.question.prompt !== "string") return false;
  if (!Array.isArray(value.question.options)) return false;
  if (value.probe !== null && typeof value.probe !== "string") return false;
  if (typeof value.reason !== "string") return false;
  if (value.answer !== null) {
    if (!isRecord(value.answer)) return false;
    if (typeof value.answer.questionId !== "string") return false;
    if (!Array.isArray(value.answer.optionIds)) return false;
    if (typeof value.answer.unknown !== "boolean") return false;
  }
  return true;
}

function isAssessmentDraft(value: unknown): value is AssessmentDraft {
  if (!isRecord(value) || !hasHeader(value)) return false;
  if (value.mode !== "full" && value.mode !== "demo") return false;
  if (!Array.isArray(value.steps)) return false;
  if (value.steps.length === 0) return false;
  if (!value.steps.every(isDraftStep)) return false;
  if (typeof value.cursor !== "number") return false;
  if (value.cursor < 0 || value.cursor >= value.steps.length) return false;
  if (typeof value.basicMode !== "boolean") return false;
  return true;
}

const draftStore = createStore<AssessmentDraft>(DRAFT_KEY, isAssessmentDraft);

export const getDraftSnapshot = draftStore.getSnapshot;
export const getDraftServerSnapshot = draftStore.getServerSnapshot;
export const subscribeDraft = draftStore.subscribe;

export function saveDraft(draft: Omit<AssessmentDraft, "schemaVersion" | "savedAt">): SaveOutcome {
  return draftStore.save({
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ...draft,
  });
}

/** 测评结束（或用户明确说"重新开始"）时清掉，避免下次误问"要不要接着答"。 */
export function clearDraft(): void {
  draftStore.clear();
}
