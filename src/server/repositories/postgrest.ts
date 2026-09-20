import "server-only";

import type { AccountType, IsoDateTime, TaskProgressStatus } from "@/contracts";
import { RepositoryError } from "./errors";
import type {
  CreateSessionInput,
  ProgressRecord,
  ProgressRepository,
  SessionRecord,
  SessionRepository,
  UpsertProgressInput,
} from "./types";

/**
 * CloudBase PostgreSQL 的真实实现（HTTP / PostgREST）。
 *
 * 这个文件把《数据库接入探针记录》里那几条硬约束变成代码：
 *
 * 1. **单条 SQL 硬上限 8 秒**（网关层，改不掉）→ 这里用 6 秒客户端超时，留 2 秒余量，
 *    超时映射成 `TIMEOUT` 而不是让请求悬着。
 * 2. **错误正文是数据库原文**（会带出表名、列名）→ 只判别**错误码**，
 *    对外一律用我们自己写的文案。
 * 3. **不能 `pg` 直连**，只能走 HTTP —— 所以整条链路就是 `fetch`。
 *
 * 另外：**每次查询都带归属条件**。API Key 带 `bypassrls`，RLS 对我们无效，
 * 过滤必须写在语句里，不能靠数据库兜底。
 */

/** 网关硬上限 8 秒；这里留 2 秒余量，避免正好卡在边界上。 */
const REQUEST_TIMEOUT_MS = 6000;

const SESSION_COLUMNS = "user_id,token_hash,account_type,created_at,expires_at";
const PROGRESS_COLUMNS = "user_id,roadmap_id,task_id,status,note,updated_at";

const SESSION_TABLE = "sessions";
const PROGRESS_TABLE = "task_progress";

export interface PostgrestConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * 从环境变量读配置。两个变量缺任意一个就返回 `null`，
 * 调用方据此回退到内存实现 —— 这样**没有密钥也能启动**（工程约定之一）。
 */
export function readPostgrestConfig(): PostgrestConfig | null {
  const baseUrl = process.env.SERVER_CLOUDBASE_PG_REST_BASE_URL?.trim();
  const apiKey = process.env.SERVER_CLOUDBASE_PG_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

type QueryValue = string | number | boolean | null | undefined;

function buildPath(table: string, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return `/v1/rdb/rest/${table}${suffix ? `?${suffix}` : ""}`;
}

/** 把网关的错误码映射成我们自己的错误类型；**只用 code，不碰 message**。 */
function mapFailure(status: number, code: unknown): RepositoryError {
  const raw = typeof code === "string" ? code : "";
  const sqlState = raw.startsWith("DATABASE_") ? raw.slice("DATABASE_".length) : "";

  if (sqlState === "57014") {
    return new RepositoryError("TIMEOUT", "数据库操作超时，请稍后重试。");
  }
  if (sqlState === "23505") {
    return new RepositoryError("CONFLICT", "记录已存在。");
  }
  if (sqlState === "23503" || sqlState === "23514" || sqlState === "22P02" || sqlState === "22003") {
    return new RepositoryError("BAD_REQUEST", "提交的数据不符合约束。");
  }
  if (status === 404) {
    return new RepositoryError("NOT_FOUND", "记录不存在。");
  }
  if (status === 400 || status === 406) {
    return new RepositoryError("BAD_REQUEST", "请求条件不合法。");
  }
  if (status === 409) {
    return new RepositoryError("CONFLICT", "记录冲突。");
  }
  return new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务暂时不可用，请稍后重试。");
}

interface Row {
  [key: string]: unknown;
}

function asString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
  }
  return value;
}

function asNullableString(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
  }
  return value;
}

function toSessionRecord(row: Row): SessionRecord {
  const accountType = row.account_type;
  const createdAt = asString(row, "created_at");
  const expiresAt = asNullableString(row, "expires_at");

  return {
    userId: asString(row, "user_id"),
    tokenHash: asString(row, "token_hash"),
    accountType: (accountType === "demo" ? "demo" : "anonymous") satisfies AccountType,
    createdAt: createdAt satisfies IsoDateTime,
    expiresAt: expiresAt satisfies IsoDateTime | null,
  };
}

const PROGRESS_STATUSES: readonly TaskProgressStatus[] = [
  "not-started",
  "in-progress",
  "completed",
  "skipped",
];

function toProgressRecord(row: Row): ProgressRecord {
  const status = row.status;
  if (typeof status !== "string" || !PROGRESS_STATUSES.includes(status as TaskProgressStatus)) {
    throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
  }
  return {
    userId: asString(row, "user_id"),
    roadmapId: asString(row, "roadmap_id"),
    taskId: asString(row, "task_id"),
    status: status as TaskProgressStatus,
    note: asNullableString(row, "note"),
    updatedAt: asString(row, "updated_at"),
  };
}

/** 统一的请求出口：超时、错误映射、结构校验都在这里收口。 */
async function request(
  config: PostgrestConfig,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<unknown[]> {
  const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new RepositoryError("TIMEOUT", "数据库操作超时，请稍后重试。");
    }
    throw new RepositoryError("UPSTREAM_UNAVAILABLE", "无法连接数据服务。");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code = payload && typeof payload === "object" ? (payload as Row).code : undefined;
    throw mapFailure(response.status, code);
  }

  // DELETE 成功返回 204，没有正文
  if (text.length === 0) return [];
  if (!Array.isArray(payload)) {
    throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
  }
  return payload as unknown[];
}

export class PostgrestSessionRepository implements SessionRepository {
  private readonly config: PostgrestConfig;

  constructor(config: PostgrestConfig) {
    this.config = config;
  }

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    if (!input.tokenHash) {
      throw new RepositoryError("BAD_REQUEST", "缺少会话摘要");
    }

    const rows = await request(
      this.config,
      "POST",
      buildPath(SESSION_TABLE, { select: SESSION_COLUMNS }),
      {
        token_hash: input.tokenHash,
        account_type: input.accountType,
        created_at: input.now,
        expires_at: input.expiresAt,
      },
      "return=representation",
    );

    const row = rows[0];
    if (!row) {
      throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
    }
    return toSessionRecord(row as Row);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const rows = await request(
      this.config,
      "GET",
      buildPath(SESSION_TABLE, {
        select: SESSION_COLUMNS,
        token_hash: `eq.${tokenHash}`,
        limit: 1,
      }),
    );
    if (rows.length === 0) return null;
    return toSessionRecord(rows[0] as Row);
  }

  async removeByTokenHash(tokenHash: string): Promise<void> {
    await request(
      this.config,
      "DELETE",
      buildPath(SESSION_TABLE, { token_hash: `eq.${tokenHash}` }),
    );
  }
}

export class PostgrestProgressRepository implements ProgressRepository {
  private readonly config: PostgrestConfig;

  constructor(config: PostgrestConfig) {
    this.config = config;
  }

  /** 没有归属就无法读写 —— 与内存实现保持同一条约束。 */
  private static requireOwner(userId: string): void {
    if (typeof userId !== "string" || userId.length === 0) {
      throw new RepositoryError("BAD_REQUEST", "缺少用户归属，拒绝访问");
    }
  }

  async listByUser(userId: string, roadmapId: string): Promise<ProgressRecord[]> {
    PostgrestProgressRepository.requireOwner(userId);
    const rows = await request(
      this.config,
      "GET",
      buildPath(PROGRESS_TABLE, {
        select: PROGRESS_COLUMNS,
        user_id: `eq.${userId}`,
        roadmap_id: `eq.${roadmapId}`,
        order: "task_id.asc",
      }),
    );
    return rows.map((row) => toProgressRecord(row as Row));
  }

  async upsert(userId: string, input: UpsertProgressInput): Promise<ProgressRecord> {
    PostgrestProgressRepository.requireOwner(userId);
    if (!input.taskId) {
      throw new RepositoryError("BAD_REQUEST", "缺少任务标识");
    }

    const rows = await request(
      this.config,
      "POST",
      buildPath(PROGRESS_TABLE, {
        select: PROGRESS_COLUMNS,
        on_conflict: "user_id,roadmap_id,task_id",
      }),
      {
        user_id: userId,
        roadmap_id: input.roadmapId,
        task_id: input.taskId,
        status: input.status,
        note: input.note,
        updated_at: input.now,
      },
      "resolution=merge-duplicates,return=representation",
    );

    const row = rows[0];
    if (!row) {
      throw new RepositoryError("UPSTREAM_UNAVAILABLE", "数据服务返回的结构不符合预期。");
    }
    return toProgressRecord(row as Row);
  }
}
