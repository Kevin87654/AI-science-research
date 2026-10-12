/**
 * 「奇思妙想」与「入门前置路线」的本地存储（B 负责）。
 *
 * 为什么放本地而不是服务端：本轮画像 / 路线本身也还在本地（`local-bridge.ts`），
 * 奇思妙想的记录与前置路线缓存是它们的补充，沿用同一套过渡策略。
 *
 * 两条纪律与 `local-bridge.ts` 一致：
 * 1. **读取一律做结构校验**：localStorage 可被用户或旧版本写坏，校验不过就当没有。
 * 2. **引用稳定**：`useSyncExternalStore` 要求快照内容没变就返回同一个对象，
 *    这里按原始字符串缓存一层；无数据时返回冻结的空状态哨兵。
 *
 * 存储结构是一整份 `SparkState`：奇思妙想记录列表 + 前置路线缓存。
 * 放在一个 key 下，避免两处各自管理又互相引用。
 */
import type { InterestEntryRoute, InterestTag, SparkAnalysis, SparkEntry } from "@/contracts";

const STORAGE_KEY = "research-assistant:sparks:v1";
const SCHEMA_VERSION = "1.0.0";
/** 最多保留的记录数，防止无限增长。 */
const MAX_SPARKS = 20;

export type SparkState = {
  schemaVersion: string;
  /** 奇思妙想记录，新的在前。 */
  sparks: SparkEntry[];
  /** 方向 id → 已生成的入门前置路线（缓存，避免重复调模型）。 */
  entryRoutes: Record<string, InterestEntryRoute>;
  /**
   * 用户手动补充的兴趣方向（「对测评结果不满意？」入口，第三轮新增）。
   *
   * 画像页的「兴趣方向」与学习路线页的「入门前置路线」都从这一份读，
   * 保证两处列表同步。版本号没升：旧数据没有这个字段，读取时按空数组兜底。
   */
  manualInterests: InterestTag[];
};

export type SaveOutcome = { ok: true } | { ok: false; message: string };

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedRaw: string | null = null;
let cachedState: SparkState | null = null;

/** 无数据时的稳定哨兵（冻结，保证引用恒定）。 */
const EMPTY_STATE: SparkState = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  sparks: [] as SparkEntry[],
  entryRoutes: {} as Record<string, InterestEntryRoute>,
  manualInterests: [] as InterestTag[],
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInterestTag(value: unknown): value is InterestTag {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    (value.source === "user-input" || value.source === "derived")
  );
}

function isEntryItemArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) => isRecord(item) && typeof item.title === "string" && typeof item.why === "string",
  );
}

function isSparkAnalysis(value: unknown): value is SparkAnalysis {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === SCHEMA_VERSION &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    Array.isArray(value.highlights) &&
    value.highlights.every((item) => typeof item === "string") &&
    Array.isArray(value.interests) &&
    value.interests.every(isInterestTag) &&
    typeof value.rationale === "string" &&
    (value.response === null || typeof value.response === "string") &&
    typeof value.generatedAt === "string"
  );
}

function isEntryRoute(value: unknown): value is InterestEntryRoute {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === SCHEMA_VERSION &&
    typeof value.id === "string" &&
    isInterestTag(value.direction) &&
    typeof value.overview === "string" &&
    isEntryItemArray(value.hotspots) &&
    isEntryItemArray(value.milestones) &&
    isEntryItemArray(value.researchers) &&
    isEntryItemArray(value.entryPapers) &&
    typeof value.generatedAt === "string"
  );
}

function isSparkEntry(value: unknown): value is SparkEntry {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === SCHEMA_VERSION &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    (value.analysis === null || isSparkAnalysis(value.analysis)) &&
    typeof value.createdAt === "string"
  );
}

function isSparkState(value: unknown): value is SparkState {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(value.sparks) || !value.sparks.every(isSparkEntry)) return false;
  if (!isRecord(value.entryRoutes)) return false;
  if (!Object.values(value.entryRoutes).every(isEntryRoute)) return false;
  // manualInterests 是第三轮后加的字段：旧版本写出的数据没有它，按"缺省 = 空"放行。
  if (value.manualInterests !== undefined) {
    if (!Array.isArray(value.manualInterests) || !value.manualInterests.every(isInterestTag)) return false;
  }
  return true;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
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

export function getSparkStateSnapshot(): SparkState {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedState ?? EMPTY_STATE;

  cachedRaw = raw;
  cachedState = null;

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSparkState(parsed)) {
        // 旧数据没有 manualInterests，补成空数组，让下游不必再判空。
        cachedState = parsed.manualInterests ? parsed : { ...parsed, manualInterests: [] };
      }
    } catch {
      cachedState = null;
    }
  }

  return cachedState ?? EMPTY_STATE;
}

/** 服务端渲染没有 localStorage，一律当作空状态。 */
export function getServerSparkStateSnapshot(): SparkState {
  return EMPTY_STATE;
}

export function subscribeSparkState(listener: Listener): () => void {
  listeners.add(listener);

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

function writeState(state: SparkState): SaveOutcome {
  const store = storage();
  if (!store) {
    return { ok: false, message: "当前浏览器不允许保存本地数据，这份记录在刷新后会丢失。" };
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
    return { ok: true };
  } catch {
    return { ok: false, message: "浏览器存储空间不足，这份记录在刷新后会丢失。" };
  }
}

/** 新增一条奇思妙想记录（同 id 覆盖，最多保留 MAX_SPARKS 条）。 */
export function addSpark(entry: SparkEntry): SaveOutcome {
  const state = getSparkStateSnapshot();
  const sparks = [entry, ...state.sparks.filter((item) => item.id !== entry.id)].slice(0, MAX_SPARKS);
  return writeState({ ...state, sparks });
}

/** 构造一条奇思妙想记录（id 与版本号由这里统一生成，调用方不必关心内部格式）。 */
export function createSparkEntry(text: string, analysis: SparkAnalysis): SparkEntry {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `spark-${Date.now()}`,
    text,
    analysis,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 手动补充一个兴趣方向（「对测评结果不满意？」入口）。
 *
 * 同 id 已存在时不重复添加（幂等，返回 ok）；新方向一律**追加到尾部**，
 * 和用户「加在最后」的预期一致。画像页与入门前置路线共读这一份，天然同步。
 */
export function addManualInterest(tag: InterestTag): SaveOutcome {
  const state = getSparkStateSnapshot();
  if (state.manualInterests.some((item) => item.id === tag.id)) return { ok: true };
  return writeState({ ...state, manualInterests: [...state.manualInterests, tag] });
}

/** 缓存某个方向的入门前置路线（按方向 id 覆盖）。 */
export function saveEntryRoute(route: InterestEntryRoute): SaveOutcome {
  const state = getSparkStateSnapshot();
  return writeState({
    ...state,
    entryRoutes: { ...state.entryRoutes, [route.direction.id]: route },
  });
}

export function getEntryRoute(directionId: string): InterestEntryRoute | null {
  return getSparkStateSnapshot().entryRoutes[directionId] ?? null;
}

export function deleteSpark(id: string): SaveOutcome {
  const state = getSparkStateSnapshot();
  return writeState({ ...state, sparks: state.sparks.filter((item) => item.id !== id) });
}

/**
 * 汇总兴趣方向（去重、保持插入顺序）：
 * 画像（测评探测）在前，奇思妙想其次，用户手动补充的最后（追加到尾部）。
 *
 * 学习路线的「入门前置路线」据此确定方向来源；画像页传 `sparks=[]` 复用
 * 同一个合并逻辑，两处列表因此保持一致。确定性纯函数，便于测试。
 */
export function collectInterestTags(
  profileInterests: InterestTag[],
  sparks: SparkEntry[],
  manualInterests: InterestTag[] = [],
): InterestTag[] {
  const byId = new Map<string, InterestTag>();
  for (const tag of profileInterests) byId.set(tag.id, tag);
  for (const entry of sparks) {
    if (!entry.analysis) continue;
    for (const tag of entry.analysis.interests) byId.set(tag.id, tag);
  }
  // 手动补充只补「还没出现过」的方向：测评/奇思妙想已推导出的不重复占位。
  for (const tag of manualInterests) {
    if (!byId.has(tag.id)) byId.set(tag.id, tag);
  }
  return Array.from(byId.values());
}
