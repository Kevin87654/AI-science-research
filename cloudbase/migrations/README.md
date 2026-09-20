# 迁移投递记录

这里放连接器 `applyMigration` **实际执行过**的 SQL，文件名是 `<14 位时间戳>_<名称>.sql`。

**这是"线上到底跑过哪些迁移"的唯一权威记录。** 不要手改，不要删。

人写的源文件在 [`scripts/migrations/`](../../scripts/migrations/)，两者内容应当一致。

> ⚠️ **工具不会自动把文件写到这里。** 实测它落在 AI 助手的 MCP 运行目录
> （`~/.learnbuddy/logs/mcp-runtime/connector_cloudbase-*/cloudbase/migrations/`），
> 执行完必须**手动复制**过来。原因与复现步骤见《数据库接入探针记录》§9。

## 命名规则（实测）

- 版本号：**14 位时间戳** `YYYYMMDDHHMMSS`，必须大于已有的最新版本
- 名称：**只能小写字母与下划线，不能含数字**
- 必须显式 `confirm: true`
- 只看到任务受理**不等于**已应用 —— 要再查 `describeMigrationTask` 与 `listMigrations`

## 已投递

| 版本 | 名称 | 内容 |
|---|---|---|
| `20260918232209` | `probe_init` | 探针：HTTP API CRUD 测试表 |
| `20260918234741` | `vector_probe` | 探针：pgvector 可用性 |
| `20260920160000` | `probe_datatype_rls_rpc` | 探针：类型/编码、RLS 对照、RPC 可达性 |
| `20260920160500` | `probe_limits_and_errors` | 探针：超时与错误形态 |
| `20260920161000` | `probe_guc_and_headers` | 探针：网关 GUC 与请求头暴露面 |
| `20260920161500` | `probe_tx_function` | 探针：函数内事务原子性 |
| `20260920162000` | `probe_timeout_override` | 探针：验证 8 秒超时能否在函数内覆盖（结论：不能） |
| **`20260920200000`** | **`init_sessions_progress`** | **业务表：`public.sessions` + `public.task_progress`** |

> 前 7 条是**探针迁移**（2026-09-18 / 09-20 的探索阶段产物），没有对应的源文件放进 `scripts/migrations/` ——
> 它们的内容、结论与清理 SQL 都记在《数据库接入探针记录》§11，探针对象本身也还留在库里供复现。
> **从 `20260920200000` 起才是业务表，源文件与投递记录成对维护。**
