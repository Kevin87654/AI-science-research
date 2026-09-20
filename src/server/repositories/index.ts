import "server-only";

import { InMemoryProgressRepository, InMemorySessionRepository } from "./in-memory";
import type { ProgressRepository, SessionRepository } from "./types";

/**
 * 当前生效的数据访问实现。
 *
 * **Step ③ 接入真实数据库时只改这一个文件** —— 换成 PostgREST 实现即可，
 * 接口与所有调用方都不用动。这也正是「外部依赖走适配器层」这条要求的落点。
 *
 * ⚠️ 现在是内存实现，**不持久化**：进程重启即丢，Serverless 上每个实例各有一份。
 * 选它是为了让第一条流程先跑通、并被测试覆盖，**不代表数据已经存住了**。
 */
export const sessionRepository: SessionRepository = new InMemorySessionRepository();
export const progressRepository: ProgressRepository = new InMemoryProgressRepository();
