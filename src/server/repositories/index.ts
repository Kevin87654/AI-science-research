import "server-only";

import { InMemoryProgressRepository, InMemorySessionRepository } from "./in-memory";
import {
  PostgrestProgressRepository,
  PostgrestSessionRepository,
  readPostgrestConfig,
} from "./postgrest";
import type { ProgressRepository, SessionRepository } from "./types";

/**
 * 当前生效的数据访问实现。
 *
 * **有配置就用真库，没配置就用内存。** 这样两条要求同时成立：
 *   · 不填任何密钥也能 `pnpm dev` 起来（工程约定之一）；
 *   · 一旦 `.env.local` / 部署平台里给了两个 `SERVER_CLOUDBASE_*` 变量，
 *     自动切到 CloudBase PostgreSQL，接口与调用方一行都不用改。
 *
 * ⚠️ 内存实现**不持久化**：进程重启即丢，Serverless 上每个实例各有一份。
 * 它只用于本地开发与测试。`/api/ping` 会如实报告当前用的是哪一种。
 */
const config = readPostgrestConfig();

/** 是否连接了真实数据库。用于自检接口与运维排查。 */
export const usingPersistentStore: boolean = config !== null;

export const sessionRepository: SessionRepository = config
  ? new PostgrestSessionRepository(config)
  : new InMemorySessionRepository();

export const progressRepository: ProgressRepository = config
  ? new PostgrestProgressRepository(config)
  : new InMemoryProgressRepository();
