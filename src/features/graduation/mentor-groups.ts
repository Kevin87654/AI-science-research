/**
 * 导师「组内学生」名单（⚠️ 演示期存在 localStorage）。
 *
 * 将来落库的形状是关系表，而不是这里的嵌套数组：
 *
 * ```sql
 * create table public.mentor_students (
 *   mentor_id  uuid not null references public.accounts (id),
 *   student_id uuid not null references public.accounts (id),
 *   created_at timestamptz not null default now(),
 *   primary key (mentor_id, student_id)
 * );
 * ```
 * 但现在账号还没有 id（学号/工号就是身份），所以先按字符串存，
 * 换成真表时把 `studentId` 换成 uuid 即可，界面不用动。
 *
 * 归属规则与仓库里其它数据一致：**所有读写都带 mentorId**，没有"列出全部小组"的接口。
 */
const GROUPS_KEY = "research-assistant:mentor-groups:v1";
const SCHEMA_VERSION = "1.0.0";

export interface MentorGroupsState {
  schemaVersion: string;
  /** mentorId → 学生账号 id 列表（保持添加顺序）。 */
  groups: Record<string, string[]>;
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

function isGroupsState(value: unknown): value is MentorGroupsState {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isRecord(value.groups)) return false;
  return Object.values(value.groups).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string" && id.length > 0),
  );
}

const listeners = new Set<Listener>();

let cachedRaw: string | null | undefined;
let cachedState: MentorGroupsState | null = null;

function readRaw(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(GROUPS_KEY);
  } catch {
    return null;
  }
}

export function getGroupsSnapshot(): MentorGroupsState | null {
  const raw = readRaw();
  if (cachedRaw !== undefined && raw === cachedRaw) return cachedState;

  cachedRaw = raw;
  cachedState = { schemaVersion: SCHEMA_VERSION, groups: {} };

  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isGroupsState(parsed)) cachedState = parsed;
    } catch {
      /* 坏数据按"还没有小组"处理 */
    }
  }

  return cachedState;
}

export function getServerGroupsSnapshot(): MentorGroupsState | null {
  return null;
}

export function subscribeGroups(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === GROUPS_KEY || event.key === null) listener();
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

function writeGroups(groups: Record<string, string[]>): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(
      GROUPS_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, groups } satisfies MentorGroupsState),
    );
  } catch {
    return false;
  }
  emitChange();
  return true;
}

/** 某位导师的学生 id 列表。没有小组时返回空数组（不是 `null`，界面不用多一层判断）。 */
export function studentsOf(state: MentorGroupsState | null, mentorId: string): string[] {
  if (!state) return [];
  return state.groups[mentorId] ?? [];
}

export type GroupWriteOutcome =
  | { ok: true; added: boolean }
  | { ok: false; message: string };

/** 添加学生。重复添加不算错误，返回 `added: false`，由界面提示"已经在组里了"。 */
export function addStudent(mentorId: string, studentId: string): GroupWriteOutcome {
  if (mentorId.trim().length === 0 || studentId.trim().length === 0) {
    return { ok: false, message: "缺少账号信息，请重新登录。" };
  }

  const current = getGroupsSnapshot();
  const groups = current ? { ...current.groups } : {};
  const own = groups[mentorId] ?? [];

  if (own.includes(studentId)) return { ok: true, added: false };

  groups[mentorId] = [...own, studentId];
  if (!writeGroups(groups)) {
    return { ok: false, message: "保存失败：当前浏览器不允许写入本地数据。" };
  }
  return { ok: true, added: true };
}

export function removeStudent(mentorId: string, studentId: string): boolean {
  const current = getGroupsSnapshot();
  if (!current) return false;
  const own = current.groups[mentorId] ?? [];
  const next = own.filter((id) => id !== studentId);
  if (next.length === own.length) return false;

  return writeGroups({ ...current.groups, [mentorId]: next });
}
