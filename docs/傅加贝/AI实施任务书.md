# 科研小助理 AI 实施任务书

> 版本：v1.0  
> 日期：2026-09-19  
> 用途：直接交给比赛专用开发 Agent，按阶段实施 Web 项目  
> 配套设计文档：[科研小助理技术设计与实施方案.md](./科研小助理技术设计与实施方案.md)

## 0. 实施目标

开发一个面向大一新生的科研成长 Web 应用，完成以下核心闭环：

```text
匿名进入
  ↓
科研认知测评
  ↓
生成科研画像
  ↓
生成个性化学习路线
  ↓
检索科研知识、实验室、导师和比赛
  ↓
完成任务并保存成长记录
```

扩展功能：

- 论文阅读和写作训练
- 科研简历草稿
- 联系导师邮件草稿

提交版默认不调用实时外部模型。核心能力采用规则引擎、模板、可信资料检索和受控任务编排器实现。

---

## 1. 已确定的技术架构

```text
浏览器
  ↓
Next.js App Router + TypeScript
  ↓
Vercel Functions（hkg1）
  ↓
Repository 数据适配层
  ↓ HTTPS/PostgREST
CloudBase PostgreSQL 17
```

技术栈：

| 模块 | 选择 |
|---|---|
| 全栈框架 | Next.js App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 表单 | React Hook Form + Zod |
| 后端 | Next.js Route Handlers / Vercel Functions |
| 数据库 | CloudBase PostgreSQL 17 |
| 数据访问 | PostgREST HTTP API + Repository 适配器 |
| 登录 | 服务端匿名会话方案 A |
| 部署 | Vercel，Functions 区域 `hkg1` |
| AI | 默认 `disabled`，仅保留可替换接口 |
| 包管理器 | pnpm |
| Node.js | Vercel 当前支持的 Node.js 22 LTS |

禁止擅自改为：

- CloudBase 静态托管主体
- CloudBase 文档数据库
- Supabase 或 Neon
- 多 Agent 系统
- 默认启用第三方模型
- 自动爬虫
- PDF 批量解析
- 导师主观评分
- 论文代写

---

## 2. Agent 总体工作规则

实施 Agent 必须遵守：

1. 开始前检查仓库现状和已有文件，不覆盖用户已有内容。
2. 严格按阶段执行，一次只完成一个可验收阶段。
3. 每阶段开始前说明：目标、计划修改的文件、预期验收方式。
4. 每阶段结束运行：Lint、Type Check、相关测试和 Build。
5. 未通过当前阶段验收，不进入下一阶段。
6. 所有数据库访问必须经过 Repository，不在页面或 Route Handler 中散落 PostgREST 请求。
7. 所有私有数据操作必须从服务端会话获得 `userId`。
8. 不接受前端传入的 `userId` 作为权限依据。
9. CloudBase API Key、会话密钥和其他 Secret 不得写入源码、日志或聊天记录。
10. 数据库迁移文件必须进入仓库；禁止只在控制台改表而不保存 SQL。
11. 实时 AI 默认关闭，不得为了演示效果擅自启用。
12. 发现平台行为与文档不一致时，先做最小探针，记录结果，再修改方案。
13. 遇到“必须人工完成”的步骤时停止，并明确告诉用户需要做什么、在哪个控制台操作、完成后提供什么非敏感结果。
14. 不要求用户把真实 Secret 粘贴到对话中。

---

## 3. 人工账号和平台准备

本节全部是人工前置条件。实施 Agent 在这些条件未满足时不得假装已经配置成功。

### 3.1 GitHub 或 Gitee

需要：

- 一个可用于比赛提交的账号
- 一个项目仓库
- 团队成员协作权限

建议：

- 仓库暂时设为 Private，提交前根据开源要求决定是否 Public
- 默认分支使用 `main`
- 开启分支保护不是 P0，可后续补充

人工操作：

1. 创建仓库，例如 `research-buddy`。
2. 邀请队员。
3. 告诉实施 Agent 仓库是否已初始化，不提供账号密码。

如果当前代码只在本地，Agent 可以初始化 Git，但推送远程仓库前应告知用户。

### 3.2 Vercel

需要：

- 一个 Vercel 账号
- 与 GitHub/Gitee 仓库连接的权限
- 创建项目和配置环境变量的权限

人工操作：

1. 注册或登录 Vercel。
2. 授权 Vercel 读取目标仓库。
3. 从仓库创建 Vercel Project。
4. 暂时不要填入真实 CloudBase API Key，等 Agent 创建 `.env.example` 后再配置。
5. 将 Production Branch 设置为 `main`。

不需要：

- 额外购买域名
- 额外注册 Auth0、Clerk、Supabase 或 Neon
- 将 Vercel 账号密码交给 Agent

### 3.3 腾讯云与 CloudBase

需要：

- 腾讯云账号
- 已存在的 CloudBase PostgreSQL 环境
- PostgreSQL 管控权限
- 创建或查看 CloudBase API Key 的权限
- 通过控制台、CLI 或连接器执行迁移 SQL 的能力

当前探针已经确认：

- 数据库是 PostgreSQL 17
- 公网标准 `pg` 直连不可用
- PostgREST HTTP CRUD 可用
- pgvector 可用，但 P0 不启用

人工操作：

1. 确认使用哪个 CloudBase 环境作为开发环境。
2. 确认是否能额外创建测试环境；如不能，至少创建带测试前缀的数据或独立 Schema。
3. 在 CloudBase 环境配置中创建服务端 API Key。
4. 记录 PostgREST 网关 Base URL。
5. 不要把 Key 粘贴给 Agent或写入 Markdown。

用户最终只需要向 Agent确认以下非敏感信息：

```text
CloudBase PostgreSQL 环境已可用：是/否
PostgREST Base URL 已取得：是/否
服务端 API Key 已创建：是/否
可以执行迁移 SQL：是/否
是否有独立测试环境：是/否
```

### 3.4 LearnBuddy 或 CodeBuddy

需要：

- 比赛提供的 LearnBuddy/CodeBuddy 账号
- 能够导出或保留开发对话记录

用途：

- 需求讨论
- 技术选型
- 编码过程
- 调试过程
- 测试设计
- 赛后复盘

提交版 Web 默认不依赖其运行时 API。人工应持续保存对话记录，避免最后补录。

### 3.5 不需要注册的额外服务

当前方案不需要：

- Supabase
- Neon
- Auth0
- Clerk
- OpenAI API
- DeepSeek API
- Cloudflare Workers
- 独立向量数据库
- 独立对象存储

如果实施 Agent认为必须新增服务，必须先解释必要性、费用、风险和替代方案，经用户同意后才能加入。

---

## 4. Secret 和环境变量配置

### 4.1 Agent 创建的模板

Agent 应创建 `.env.example`：

```env
APP_ENV=development

CLOUDBASE_PG_REST_BASE_URL=
CLOUDBASE_PG_API_KEY=

SESSION_SECRET=
SESSION_COOKIE_NAME=research_session
SESSION_TTL_SECONDS=604800

AI_PROVIDER=disabled
AI_MODEL=
AI_REQUEST_TIMEOUT_MS=25000
AI_MAX_TOOL_STEPS=4
ENABLE_RUNTIME_AI=false

NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
```

必须将 `.env.local` 加入 `.gitignore`。

### 4.2 必须由人工填写的 Secret

用户需要在本地 `.env.local` 和 Vercel Dashboard 中手动填写：

- `CLOUDBASE_PG_REST_BASE_URL`
- `CLOUDBASE_PG_API_KEY`
- `SESSION_SECRET`

`SESSION_SECRET` 要求：

- 至少 32 字节安全随机值
- Preview 和 Production 使用不同值
- 不通过聊天发送
- 不进入 Git

### 4.3 Vercel 环境变量范围

人工在 Vercel Project → Settings → Environment Variables 中配置：

| 变量 | Development | Preview | Production |
|---|---:|---:|---:|
| `CLOUDBASE_PG_REST_BASE_URL` | 可选 | 测试环境 | 生产环境 |
| `CLOUDBASE_PG_API_KEY` | 可选 | 测试 Key | 生产 Key |
| `SESSION_SECRET` | 本地 | Preview Secret | Production Secret |
| `AI_PROVIDER` | `disabled` | `disabled` | `disabled` |
| `ENABLE_RUNTIME_AI` | `false` | `false` | `false` |

如果没有独立测试数据库：

- Preview 不得执行清理、批量导入或破坏性操作
- 测试用户必须使用 `account_type=demo` 或独立命名空间
- Production Key 仍不可暴露给 Preview 构建日志

### 4.4 人工检查点

配置完成后，用户只回复：

```text
本地环境变量已配置
Vercel Preview 环境变量已配置
Vercel Production 环境变量已配置
```

不要在对话中回复具体值。

---

## 5. 阶段一：创建项目骨架

### 5.1 Agent 工作

1. 使用 Next.js App Router、TypeScript、Tailwind、ESLint 创建项目。
2. 使用 pnpm 并提交 `pnpm-lock.yaml`。
3. 安装并配置：
   - shadcn/ui
   - Zod
   - React Hook Form
   - 测试框架
4. 创建以下目录：

```text
app/
components/
features/
server/auth/
server/services/
server/repositories/
server/orchestrator/
server/llm/
shared/schemas/
shared/types/
content/
scripts/migrations/
tests/
docs/
```

5. 创建基础页面和 `/api/health`。
6. 配置 Node.js Runtime 和香港区域：

```ts
export const runtime = 'nodejs';
export const preferredRegion = 'hkg1';
```

7. 创建统一错误响应和 requestId 中间逻辑。

### 5.2 验收

- `pnpm lint` 通过
- TypeScript 检查通过
- `pnpm build` 通过
- `/api/health` 返回版本、环境和 requestId
- 健康接口不返回任何 Secret

### 5.3 人工介入

用户需要：

- 确认项目名称
- 确认远程仓库地址
- 决定是否允许 Agent首次推送

---

## 6. 阶段二：数据库迁移设计

### 6.1 Agent 工作

Agent 创建编号迁移文件，例如：

```text
scripts/migrations/
├─ 001_extensions.sql
├─ 002_core_tables.sql
├─ 003_content_tables.sql
├─ 004_indexes.sql
├─ 005_rpcs.sql
└─ 006_seed_assessment.sql
```

首批表：

```text
users
sessions
research_profiles
assessment_questions
assessment_sessions
learning_plans
knowledge_items
labs
mentors
competitions
sources
chat_sessions
```

约定：

- 主键使用 UUID
- 时间使用 `timestamptz`
- SQL 使用 `snake_case`
- TypeScript 使用 `camelCase`
- 标签使用 `text[]`
- 可变嵌套数据使用 `jsonb`
- 用户私有表必须有 `user_id`
- 外键和常用查询字段建立索引
- P0 不创建向量列

### 6.2 必须创建的 RPC

建议首批：

```text
create_anonymous_user_and_session
revoke_session
submit_assessment
replace_active_learning_plan
mark_learning_task_done
consume_rate_limit
```

RPC 要求：

- 参数固定
- 返回结构固定
- 在事务中执行
- 不接受任意 SQL
- 能重复调用时使用幂等键

### 6.3 人工介入：执行迁移

迁移不能由 Vercel 运行时直接执行。

Agent 完成 SQL 后必须停止，请用户：

1. 审查迁移目标环境。
2. 在 CloudBase 控制台 SQL 编辑器、CLI 或已授权连接器中执行迁移。
3. 返回“迁移成功/失败”和错误文本，不返回 API Key。
4. 在数据库中确认表、索引和 RPC 已创建。

### 6.4 验收

- 所有表存在
- `sessions.token_hash` 唯一索引存在
- 用户私有表有 `user_id` 索引
- RPC 可以在测试数据上运行
- 重复运行迁移不会静默破坏已有数据
- 迁移 SQL 已进入仓库

---

## 7. 阶段三：CloudBase Repository 与线上探针

### 7.1 Agent 工作

创建：

```text
server/repositories/interfaces.ts
server/repositories/cloudbase-postgrest.ts
```

Repository 必须负责：

- Base URL 和认证头
- 请求超时
- URL 参数编码
- 字段、排序、表和 RPC 白名单
- SQL `snake_case` 与 TypeScript `camelCase` 转换
- 上游错误脱敏
- `cloudbaseDurationMs` 记录
- 用户私有查询自动附加所有权条件

禁止：

- 将前端过滤字符串原样拼入 URL
- 将完整 CloudBase 错误返回浏览器
- 让前端选择任意表或 RPC
- 在客户端 Bundle 中导入 Repository

### 7.2 创建数据库探针

创建受保护的临时接口或脚本，完成：

```text
查询
插入
条件查询
更新
删除
RPC 调用
```

每一步记录：

- HTTP 状态码
- 耗时
- requestId
- 是否成功

不得输出 API Key 或完整认证头。

### 7.3 人工介入：Vercel 部署

用户需要：

1. 确认 Vercel 已连接仓库。
2. 确认 Preview 环境变量已配置。
3. 触发 Preview 部署。
4. 在手机流量和电脑浏览器中打开 Preview URL。
5. 将探针结果和非敏感日志反馈给 Agent。

### 7.4 阻断性验收

必须同时满足：

- Vercel Function 实际运行区域为 `hkg1`
- Vercel → CloudBase CRUD 全部成功
- 记录 P50/P95 或至少多次真实耗时
- 单次简单数据库请求没有不可接受的延迟
- API Key 不出现在浏览器 Network、HTML、JS Bundle 或错误页面
- 探针接口不能被未授权用户反复调用

如果失败，Agent 必须先诊断，不进入功能开发。

---

## 8. 阶段四：匿名会话方案 A

### 8.1 会话流程

```text
POST /api/session/bootstrap
  ↓
读取 HttpOnly Cookie
  ↓
没有有效会话
  ↓
生成 256 bit 随机 Token
  ↓
SHA-256 后写入 sessions
  ↓
原始 Token 写入 HttpOnly Cookie
  ↓
返回匿名用户基本信息
```

### 8.2 Cookie 属性

生产环境：

```text
HttpOnly=true
Secure=true
SameSite=Lax
Path=/
Max-Age=SESSION_TTL_SECONDS
```

本地开发可根据 HTTPS 状态调整 `Secure`，但生产不能关闭。

### 8.3 Agent 工作

实现：

- `POST /api/session/bootstrap`
- `DELETE /api/session`
- `GET /api/me`
- `requireSession()`
- Token 生成和哈希
- 会话过期和撤销
- Origin 校验
- 会话创建限流
- 过期会话清理脚本

### 8.4 必须测试的攻击场景

- 伪造 Cookie
- 修改 Cookie
- 使用已过期 Cookie
- 使用已撤销 Cookie
- 请求中传入其他人的 `userId`
- 用户 A 请求用户 B 的资源 ID
- 跨站 Origin 发起修改请求
- 连续调用 bootstrap 制造大量会话

### 8.5 验收

- 原始 Token 不进入数据库和日志
- 数据库只保存 Token 哈希
- 注销后旧 Cookie 失效
- 用户 A 无法读取用户 B 的任何私有数据
- 清除 Cookie 后创建新匿名身份，产品明确提示数据与当前浏览器绑定

---

## 9. 阶段五：内容数据管线

### 9.1 Agent 工作

创建：

```text
content/
├─ assessments/
├─ research-basics/
├─ paper-writing/
├─ labs/
├─ mentors/
└─ competitions/
```

创建：

- Zod 内容 Schema
- `validate-content` 脚本
- `import-content` 脚本
- 来源 URL 校验
- 重复项检查
- 导入批次号

### 9.2 人工介入：资料收集与核验

以下工作必须由团队成员完成或复核：

- 收集深圳大学、学院、实验室和教师官网资料
- 核对研究方向、职称、实验室归属
- 核对科研比赛官网和有效期
- 确认联系方式确实为公开信息
- 标记资料核验日期

Agent 可以协助整理格式，但不能把自己生成的导师事实标为已核验。

### 9.3 导入前人工确认

用户需确认：

```text
本批资料来源已抽查
没有未经公开的个人联系方式
没有导师主观评分或负面评价
导入目标是测试环境/生产环境
```

### 9.4 验收

- 每条事实资料至少有一个来源
- 页面可显示来源和核验日期
- 失效链接可以标为待复核
- 重复导入不会无限复制数据
- 导入批次可识别和回滚/禁用

---

## 10. 阶段六：核心产品功能

按以下顺序实现，不能倒序铺开。

### 10.1 科研认知测评

功能：

- 单选或多选题
- 每题提供“不知道/不了解”选项
- 进度保存
- 提交前校验
- 规则评分
- 画像模板

验收：关闭 AI 时可完整生成可理解的科研画像。

### 10.2 科研画像

至少包含：

- 当前阶段
- 兴趣方向
- 优势
- 知识缺口
- 推荐下一步

禁止使用侮辱性或决定论标签。

### 10.3 学习路线

规则输入：

- 专业
- 兴趣
- 科研认知等级
- 每周可投入时间
- 目标

输出：

- 总目标
- 周期
- 可执行任务
- 预计时间
- 关联资源
- 完成标准

### 10.4 Dashboard 与成长记录

显示：

- 当前科研阶段
- 下一项任务
- 路线进度
- 已完成任务
- 最近兴趣方向
- 推荐资料

首页不能只是聊天框。

### 10.5 知识、实验室、导师和比赛检索

第一版使用：

- 标签匹配
- 学院和专业过滤
- 关键词匹配
- 来源展示

不启用 pgvector，除非传统检索经测试确实无法满足需求。

### 10.6 论文训练或科研简历

P1 至少完成一项：

- 论文结构识别/摘要拆解训练
- 基于真实档案的科研简历草稿

不得生成完整论文或虚构用户经历。

---

## 11. 阶段七：受控任务编排器

### 11.1 默认工作方式

不用实时大模型，根据页面场景和规则调用工具：

```text
get_user_profile
search_knowledge
search_labs
search_mentors
search_competitions
get_learning_plan
save_learning_plan
update_task_progress
get_resume_facts
```

### 11.2 实现要求

- 工具注册表
- 输入 Zod Schema
- 输出 Zod Schema
- 权限校验
- 来源 ID 返回
- 最多执行固定步骤数
- 结构化日志
- 无数据时明确提示

### 11.3 可选 AI Provider

只创建接口和 DisabledProvider：

```ts
interface LLMProvider {
  generate<T>(input: GenerateInput<T>): Promise<GenerateResult<T>>;
  healthCheck(): Promise<ProviderHealth>;
}
```

生产配置：

```env
AI_PROVIDER=disabled
ENABLE_RUNTIME_AI=false
```

没有用户明确授权和赛事口径确认，不实现或启用真实 Provider。

---

## 12. 阶段八：安全加固

Agent 必须逐项完成：

### 12.1 CloudBase Key

- 只在服务端读取
- 不进入 `NEXT_PUBLIC_*`
- 不输出上游认证头
- 不把完整上游错误返回前端
- 编写 Key 泄露检查说明

### 12.2 IDOR

- 每个私有资源先验证所有权
- 自动测试用户 A/B 隔离
- Repository 强制附加 `user_id`

### 12.3 CSRF

- 修改请求验证 Origin
- Cookie 使用 SameSite=Lax
- 高风险修改增加 CSRF Token

### 12.4 PostgREST

- 表名、字段名、排序和 RPC 白名单
- 参数 URL 编码
- 限制 `limit`
- 不接受原始过滤字符串

### 12.5 限流与幂等

- 不使用进程内 `Map` 作为唯一限流器
- 使用 PostgreSQL RPC 原子计数
- 写接口支持幂等键
- 防止重复创建画像和学习计划

### 12.6 SSRF 和外链

- 不提供任意 URL 服务端抓取
- 仅展示已核验 HTTPS 链接
- 外链使用 `noopener noreferrer`

---

## 13. 阶段九：测试

### 13.1 单元测试

覆盖：

- 测评分数
- 画像规则
- 路线生成
- Token 哈希与过期
- Cookie 属性
- Origin 校验
- Repository 字段映射
- PostgREST 参数白名单
- 所有权判断
- 来源去重

### 13.2 集成测试

覆盖：

- 匿名用户创建和恢复
- 会话撤销
- 测评提交和画像入库
- 路线生成和任务更新
- 实验室检索和来源
- 用户 A/B 数据隔离
- 重复幂等请求
- CloudBase 超时和错误脱敏

### 13.3 E2E

核心路径：

```text
首次访问
  → 匿名会话
  → 完成测评
  → 查看画像
  → 生成路线
  → 完成任务
  → 搜索实验室
  → 查看来源
  → 注销
```

### 13.4 人工浏览器测试

团队成员必须使用：

- Chrome/Edge 桌面端
- 手机浏览器
- 校园网
- 家庭网络
- 手机流量

测试正式 Vercel 地址。

---

## 14. 阶段十：部署

### 14.1 Preview

Agent 工作：

- 确认 Build 通过
- 确认环境变量读取逻辑
- 确认 Preview 不使用生产写权限
- 输出部署后检查清单

人工操作：

1. 推送分支或创建 PR。
2. 等待 Vercel Preview 完成。
3. 打开 Preview URL。
4. 确认测试数据库和 Secret 范围正确。
5. 将非敏感错误信息反馈给 Agent。

### 14.2 Production

生产发布前必须人工确认：

```text
数据库迁移已完成
生产环境变量已填写
Production 使用独立 SESSION_SECRET
AI_PROVIDER=disabled
ENABLE_RUNTIME_AI=false
正式内容已核验
Demo 用户/数据可用
```

然后：

1. 合并到 `main`。
2. 由 Vercel 自动部署。
3. 检查 `/api/health`。
4. 检查匿名会话。
5. 完整执行 E2E。
6. 手机流量打开正式链接。
7. 确认 Function 位于 `hkg1`。

### 14.3 回滚

出现严重问题时：

- 前端和 API 使用 Vercel 回滚到上一个可用 Deployment
- 数据库迁移必须使用已准备的回滚脚本或兼容迁移
- 不使用临时手工删表修复

---

## 15. 比赛交付材料

开发过程中同步准备：

### 15.1 在线链接

- Vercel Production URL
- 无须注册即可体验
- 提交前再次用手机流量测试

### 15.2 Demo 视频

3 分钟建议路线：

```text
问题背景
  → 科研测评
  → 科研画像
  → 学习路线
  → 实验室/导师检索
  → 成长记录或简历
  → 技术与价值总结
```

### 15.3 PPT

至少包括：

- 用户痛点
- 产品定位
- 用户流程
- 核心功能
- 技术架构
- 数据来源
- LearnBuddy 使用过程
- 团队分工

### 15.4 源码仓库

README 包含：

- 项目简介
- 在线链接
- 技术栈
- 架构图
- 本地运行
- 环境变量说明
- 数据来源
- 测试命令
- 部署方式
- 第三方依赖
- 团队分工

### 15.5 LearnBuddy 使用记录

按阶段整理：

```text
需求分析
技术选型
数据库探针
项目骨架
测评与画像
学习路线
资料检索
安全测试
部署排错
最终复盘
```

---

## 16. AI 实施阶段的人工停止点

Agent 到达以下节点必须停止等待用户：

| 停止点 | 人工操作 |
|---|---|
| 创建远程仓库 | 注册账号、创建仓库、授权协作者 |
| 创建 Vercel Project | 登录 Vercel、连接仓库 |
| 配置 Secret | 在本地和 Vercel Dashboard 手动填写 |
| 创建 CloudBase API Key | 在腾讯云控制台完成，不在聊天中发送 |
| 执行数据库迁移 | 人工审核目标环境并执行 SQL |
| 导入生产资料 | 人工确认来源和目标环境 |
| Preview 部署 | 人工确认环境变量范围和访问结果 |
| Production 发布 | 人工确认数据库、Secret、AI 开关和内容 |
| 对外开源 | 人工确认许可证和是否存在敏感信息 |
| 最终提交 | 人工确认所有链接和文件后提交赛事平台 |

Agent 不得绕过这些停止点，也不得声称用户已完成未验证的控制台操作。

---

## 17. 最终验收标准

项目同时满足以下条件才算完成：

- Vercel 正式链接可访问
- Vercel Function 实际运行在 `hkg1`
- Vercel 到 CloudBase CRUD 探针通过
- 匿名会话可创建、恢复、过期和撤销
- 用户 A 无法读取或修改用户 B 的数据
- CloudBase API Key 不在前端 Bundle、浏览器请求、日志和仓库中
- 无实时 AI 时测评、画像、路线、检索和成长记录完整可用
- 所有导师、实验室和比赛事实带来源
- 核心 E2E 测试通过
- 手机流量访问正常
- README、Demo 视频、PPT、源码和 LearnBuddy 记录齐全

---

## 18. 交给实施 Agent 的起始指令

可以将以下内容与本文一起发送给开发 Agent：

> 请严格按照《AI实施任务书.md》执行。先检查当前仓库和配套技术设计文档，只实施“阶段一：创建项目骨架”。在开始修改前说明目标、文件范围和验收命令。完成后运行 Lint、Type Check、测试和 Build，报告结果并停止，不要自动进入下一阶段。遇到账号注册、Vercel 控制台、CloudBase API Key、数据库迁移或生产发布时必须等待人工操作，不得索取或输出真实 Secret。

