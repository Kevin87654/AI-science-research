/**
 * 学生自己添加的毕设节点（⚠️ 演示期存在 localStorage）。
 *
 * 与 `timeline-meta.ts` / `school-milestones.ts` 的分工：
 *   · 学校节点是**常量**，没有存储层；
 *   · 学生节点是**用户数据**，将来要落库（`graduation_nodes` 表，见交付说明），
 *     现在先存在本地，保证这一轮能真正"添加 → 刷新 → 还在"。
 *
 * 将来的替换点只有这个文件：把读写换到 `/api/graduation/nodes`，
 * 页面对 `useStudentNodes()` / `addNode()` / `removeNode()` 的调用不用改。
 *
 * 接口形状刻意与 `task_progress` 对齐：按 `accountId`（将来是服务端确认的 userId）分区，
 * **任何读写都必须带归属**，界面上不提供"读全表"的入口。
 */
import type { StudentNode } from "@/contracts";
import type { ValidNodeDraft } from "./node-rules";

const NODES_KEY = "research-assistant:graduation-nodes:v1";
const SCHEMA_VERSION = "1.0.0";

/** 演示学生账号。示例节点只给它，真实账号不会凭空多出数据。 */
export const DEMO_STUDENT_ID = "20220001";

/**
 * 示例节点：让导师端"查看组内学生进度"一进去就有内容可看，
 * 也顺带演示节点的信息密度（日期 + 标题 + 备注）。
 * 学生可以照常删除 —— 一旦本地写下过记录，示例节点就不会再回来。
 */
const DEMO_SEED_NODES: readonly StudentNode[] = [
  {
    id: "seed-topic-talk",
    date: "2026-11-05",
    title: "和导师确认选题方向",
    note: "初步定为「AI 辅助的毕业设计过程管理」，等任务书下来再细化范围。",
    createdAt: "2026-11-05T09:20:00.000Z",
  },
  {
    id: "seed-literature",
    date: "2026-11-08",
    title: "读完 3 篇相关综述",
    note: "重点看教育场景下 LLM 应用的三篇综述，记了 12 条笔记。",
    createdAt: "2026-11-08T13:05:00.000Z",
  },
];

export interface StudentNodesState {
  schemaVersion: string;
  /** accountId → 该学生的节点。没有键表示"还没添加过"。 */
  students: Record<string, StudentNode[]>;
}

type Listener = () => void;

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

function isNode(value: unknown): value is StudentNode {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false;
  if (typeof value.title !== "string" || value.title.trim().length === 0) return false;
  if (value.note !== null && typeof value.note !== "string") return false;
  if (typeof value.createdAt !== "string") return false;
  return !Number.isNaN(Date.parse(value.createdAt));
}

function isNodesState(value: unknown): value is StudentNodesState {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isRecord(value.students)) return false;
  return Object.values(value.students).every(
    (nodes) => Array.isArray(nodes) && nodes.every(isNode),
  );
}

const listeners = new Set<Listener>();

/** 缓存哨兵：`undefined` = 没缓存。理由见 `session-store.ts` 里同名注释。 */
let cachedRaw: string | null | undefined;
let cachedState: StudentNodesState | null = null;

function readRaw(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(NODES_KEY);
  } catch {
    return null;
  }
}

/** 示例节点只在"完全没有记录"时补上，不写入、不覆盖用户数据。 */
function withDemoSeed(students: Record<string, StudentNode[]>): Record<string, StudentNode[]> {
  if (students[DEMO_STUDENT_ID]) return students;
  return { ...students, [DEMO_STUDENT_ID]: DEMO_SEED_NODES.map((node) => ({ ...node })) };
}

export function getNodesSnapshot(): StudentNodesState | null {
  const raw = readRaw();
  if (cachedRaw !== undefined && raw === cachedRaw) return cachedState;

  cachedRaw = raw;
  cachedState = null;

  let students: Record<string, StudentNode[]> = {};
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isNodesState(parsed)) students = parsed.students;
    } catch {
      students = {};
    }
  }

  // 空存储也返回一个可用状态：页面不用为"第一次来"单独写一套空判断。
  cachedState = { schemaVersion: SCHEMA_VERSION, students: withDemoSeed(students) };
  return cachedState;
}

/** 服务端渲染时没有 localStorage，返回 `null`，界面靠 `useIsClient()` 挡住首屏。 */
export function getServerNodesSnapshot(): StudentNodesState | null {
  return null;
}

export function subscribeNodes(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === NODES_KEY || event.key === null) listener();
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

/** 取某个学生的节点（按日期升序，同一天按创建时间升序）。只返回属于该账号的记录。 */
export function nodesFor(state: StudentNodesState | null, accountId: string): StudentNode[] {
  if (!state) return [];
  const nodes = state.students[accountId] ?? [];
  return [...nodes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

function writeStudents(students: Record<string, StudentNode[]>): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(
      NODES_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, students } satisfies StudentNodesState),
    );
  } catch {
    return false;
  }
  emitChange();
  return true;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type NodeWriteOutcome = { ok: true; node: StudentNode } | { ok: false; message: string };

/**
 * 新增节点。
 *
 * 写之前先读一次快照（而不是直接用 state 变量）——
 * 另一个标签页刚加过的节点不能被这次写入覆盖掉。
 */
export function addNode(accountId: string, draft: ValidNodeDraft): NodeWriteOutcome {
  if (accountId.trim().length === 0) {
    return { ok: false, message: "找不到当前账号，请重新登录。" };
  }

  const current = getNodesSnapshot();
  const students = current ? { ...current.students } : {};
  const node: StudentNode = {
    id: makeId(),
    date: draft.date,
    title: draft.title,
    note: draft.note,
    createdAt: new Date().toISOString(),
  };

  students[accountId] = [...(students[accountId] ?? []), node];
  if (!writeStudents(students)) {
    return { ok: false, message: "保存失败：当前浏览器不允许写入本地数据。" };
  }
  return { ok: true, node };
}

export function removeNode(accountId: string, nodeId: string): boolean {
  const current = getNodesSnapshot();
  if (!current) return false;
  const own = current.students[accountId] ?? [];
  const next = own.filter((node) => node.id !== nodeId);
  if (next.length === own.length) return false;

  const students = { ...current.students, [accountId]: next };
  return writeStudents(students);
}
