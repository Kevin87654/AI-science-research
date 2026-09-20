# 数据库迁移（源文件）

**这个目录放人写的 SQL 源文件**，序号制命名（`001_xxx.sql`），便于按阶段阅读与评审。
实际执行走连接器 `applyMigration`，投递记录放在 [`cloudbase/migrations/`](../../cloudbase/migrations/)。

| 目录 | 放什么 | 命名 |
|---|---|---|
| `scripts/migrations/`（本目录） | 人写的源文件 | `001_init.sql`（序号） |
| `cloudbase/migrations/` | 实际投递记录 | `20260920200000_init_sessions_progress.sql`（14 位时间戳） |

两套不是"二选一"，而是**内容与投递**的关系：**投递后两者应当一致**，请顺手核对一次（`diff -q`）。

⚠️ **投递记录不会自动进仓库** —— 实测它落在 AI 助手的 MCP 运行目录，必须手动复制进来。
细节见《数据库接入探针记录》§9。

**迁移不由应用启动时自动执行**，由指定负责人统一安排（见《数据库交接说明》§4）。

## 已执行的迁移

| 源文件 | 投递版本 | 内容 |
|---|---|---|
| `001_init.sql` | `20260920200000_init_sessions_progress` | `public.sessions`（匿名会话）+ `public.task_progress`（任务进度）。两张表都 **enable + force RLS 且不建 policy** |

> 为什么建表时故意不建 policy：我们的 API Key 是 `service_role`（`BYPASSRLS`），RLS 挡不住我们，
> 也不指望挡我们。开着 RLS 且没有 policy 的效果是——**将来万一引入浏览器端凭据或别的账号，这些表默认读不到任何行**。
> 归属隔离由应用层负责，见 `src/server/repositories/README.md`。
