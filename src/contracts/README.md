# 公共契约

> 第一条可验收流程的**数据类型约定**：测评提交 → 画像结果 → 路线与任务 → 任务进度 → 资料与引用。
> 三人按这一份开工，不必等整个数据库设计定下来。

**怎么用**

- 业务代码统一从 `@/contracts` 取类型，不要逐个文件深引用。
- 想知道"一条数据长什么样"，直接看 [`samples.ts`](./samples.ts) —— 它是完整的最小样例，**并且会被 `tsc` 检查**（类型改了样例没改就编译失败，所以它不会和类型脱节）。
- 想知道"部署时数据怎么存"，看 [`docs/黄瑜/数据库接入探针记录.md`](../../docs/黄瑜/数据库接入探针记录.md)。

> ⚠️ 唯一权威是 `*.ts` 里的类型定义。下面每张表都是速查，字段增删**以类型为准**。

---

## 一、三条铁律

1. **身份只能由服务端确认。** 任何接口收到请求体里的 `userId` 都必须忽略，以服务端从会话解析出的身份为准。
   ⚠️ 这不是洁癖：我们的 API Key 带 `bypassrls`，**数据库层的行级权限对我们无效**，只有应用层的归属过滤能挡住越权读别人的记录。
2. **契约层只放可序列化的数据。** 不放类实例、函数、`Date` 对象、`Map`/`Set`。ESLint 已经禁止 `src/contracts/**` 导入 `@/server/**`。
3. **演示数据必须显式标记**（`isDemo` / `accountType: "demo"`），且不得与真实记录混在一起。

---

## 二、文件与归属

| 文件 | 谁负责 | 状态 |
|---|---|---|
| [`common.ts`](./common.ts) | 全体 | 已定 |
| [`source.ts`](./source.ts) | C | 沿用 C 已交付字段 |
| [`catalog.ts`](./catalog.ts) | C | 沿用 C 已交付字段 |
| [`knowledge.ts`](./knowledge.ts) | C | 沿用 C 已交付字段 |
| [`assessment.ts`](./assessment.ts) | **B** | 已定（B 于 2026-09-20 确认，并补 `AssessmentOption.score`） |
| [`profile.ts`](./profile.ts) | **B** | 已定（B 于 2026-09-20 确认，未改字段） |
| [`roadmap.ts`](./roadmap.ts) | **B** | 已定（B 于 2026-09-20 确认，未改字段） |
| [`identity.ts`](./identity.ts) | A | 已定 |
| [`progress.ts`](./progress.ts) | A | 已定 |
| [`api.ts`](./api.ts) | A | 已定（底座已有） |
| [`samples.ts`](./samples.ts) | 全体 | 最小样例，编译期校验 |

**B 的三份契约已确认（2026-09-20）。** 唯一改动是给 `AssessmentOption` 补了 `score`：
问卷本身就是"契约形状的数据"，评分依据若另存一份映射表，会随题库改动漂移；放在选项上则不可能不同步。
约定：`score` 为 **0～3**，`null` 表示该选项不计分（例如兴趣题的「还没想好」）。
兴趣题的选项 `id`/`label` 直接就是 `InterestTag` 的 `id`/`label`（`source: "derived"`）。
「不知道」**不是一个选项**，而是 `AssessmentAnswer.unknown` 标记 + 空 `optionIds`，
这样才能把"诚实地不知道"和"没作答"分开。改字段时**必须同步改 `samples.ts`**。

---

## 三、关键字段速查

### `identity.ts` —— 匿名会话

| 字段 | 含义 | 可空 |
|---|---|---|
| `userId` | 服务端生成的用户标识 | 否 |
| `kind` | 固定 `"anonymous"`，不要求注册 | 否 |
| `accountType` | `anonymous` / `demo`（演示账号标记） | 否 |
| `createdAt` | 会话创建时间 | 否 |
| `expiresAt` | 会话过期时间 | **是**，`null` 表示由 Cookie 决定 |

### `assessment.ts` —— 测评（B，已定）

| 字段 | 含义 | 可空 |
|---|---|---|
| `dimension` | PRD §8.2 的八个维度之一 | 否 |
| `type` | `single` / `multi` | 否 |
| `score` | 选项得分 0～3；`null` = 该选项不计分 | 否（可显式为 `null`） |
| `allowUnknown` | 是否提供「不知道/不了解」选项；认知题应为 `true` | 否 |
| `required` | 是否必答 | 否 |
| `optionIds` | 单选给 1 个、多选给多个 | 否（可为空数组） |
| `unknown` | 用户**明确**选了「不知道」，用于区分"没答" | 否 |
| `mode` | `full` / `demo`；演示模式减题量，**不改评分逻辑** | 否 |

> `AssessmentSubmission` **不含 `userId`**（铁律 1）。

### `profile.ts` —— 画像（B，已定）

| 字段 | 含义 | 可空 |
|---|---|---|
| `stage` | 阶段（`code` + 展示用 `label`） | 否 |
| `summary` | 一段个人状态总结 | 否 |
| `strengths` | 优势，PRD 要求 2～5 项 | 否 |
| `gaps` | **待补能力**（刻意不用负面措辞），2～5 项 | 否 |
| `interests` | 兴趣标签；**B → C 的联动入口** | 否 |
| `priorityActions` | 建议优先完成的 3 个行动 | 否 |
| `basis` | 画像生成依据说明，必填 | 否 |
| `sourceSubmissionId` | 可追溯到哪次测评提交 | 否 |
| `isDemo` | 是否演示数据 | 否 |

> `InterestTag.label` 会被 C 的 `SearchOptions.interests` 直接消费 —— 改标签文案等于改检索输入，两边要一起看。

### `roadmap.ts` —— 路线（B，已定）

| 字段 | 含义 | 可空 |
|---|---|---|
| `goal` | 总目标 | 否 |
| `suggestedWeeks` | 建议周期（周） | 否 |
| `stages[].taskIds` | 阶段包含的任务 id，顺序即展示顺序 | 否 |
| `estimatedMinutes` | 任务预计耗时（分钟），PRD §10.3 要求必有 | 否 |
| `completionCriteria` | 完成标准，至少一条 | 否 |
| `resourceIds` | 关联资料 id | 否（可为空数组） |
| `skippable` | 是否允许跳过 | 否 |
| `profileId` | 依据哪份画像生成 | 否 |

> **任务状态不在这里。** `RoadmapTask` 只描述"计划长什么样"（B），"做到哪一步"在 `progress.ts`（A）。

### `progress.ts` —— 进度（A，本轮唯一要求落库）

| 字段 | 含义 | 可空 |
|---|---|---|
| `status` | `not-started` / `in-progress` / `completed` / `skipped` | 否 |
| `note` | 用户个人备注 | **是** |
| `roadmapId` | 属于哪条路线 | 否 |
| `updatedAt` | 最近更新时间 | 否 |

> `ProgressUpdateRequest` **不含 `userId`**（铁律 1）。
> Repository 的每个查询都必须带 `owner_id` 过滤，并覆盖「伪造他人标识读不到、也写不进」的用例。

### `source.ts` / `catalog.ts` / `knowledge.ts` —— 资料与问答（C）

沿用 C 已交付的字段，含义见文件内注释。**只有以下几处可空，其余都不可空**：

| 字段 | 说明 |
|---|---|
| `Source.pageUpdatedAt` | 未知时必须是 `null`，**不得用 `checkedAt` 顶替** |
| `Source.supportedFields` | 可选：该来源能支撑哪些字段 |
| `Teacher.title` / `publicEmail` | 没有公开信息时为 `null`，不留占位文本 |
| `Teacher.recruitment.currentAvailability` | **永远是 `"unknown"`** —— 不提供名额推测 |
| `Teacher.source.pageUpdatedAt` | 同 `Source` |
| `Answer.teacherIds` | 未涉及校内资源时为空数组 |

三条产品红线已经固化在类型里：`currentAvailability` 不猜名额、`editorial` 与 `pendingConfirmation` 分开、`Answer.status` 表达的是**证据覆盖程度而不是模型置信度**。

---

## 四、HTTP 返回约定

`api.ts` 里有 `ApiResponse<T>` 和错误码类型 `ApiErrorCode`：

```ts
{ ok: true; data: T }
{ ok: false; error: { code: ApiErrorCode; message: string; requestId: string } }
```

用**业务错误码**，不要透传数据库错误码。原因见《数据库接入探针记录》§5：网关返回的 `message` 是数据库原文，会带出表名、列名和约束名。

错误码已经是类型（不再只是约定），出现新场景时在 `api.ts` 里加枚举值，并在这张表里补一行：

| code | 场景 |
|---|---|
| `BAD_REQUEST` | 入参不合法（必答题未完成、类型不符） |
| `UNAUTHORIZED` | 没有会话，或会话已失效 |
| `FORBIDDEN` | 会话有效，但这条记录不属于本人 |
| `NOT_FOUND` | 目标记录不存在 |
| `CONFLICT` | 版本冲突、重复提交 |
| `TIMEOUT` | 数据库调用超过 **8 秒**上限 |
| `UPSTREAM_UNAVAILABLE` | 上游不可用，可重试 |
| `INTERNAL` | 其他未预期错误（对外必须是中性文案） |

落地的响应工具在 [`src/server/services/api-response.ts`](../server/services/api-response.ts)（`jsonOk` / `jsonError` / `toErrorResponse`）。

---

## 五、暂未纳入契约的部分

以下 PRD 提到但**目前没有数据或没有实现**，先不定字段，避免写出没人用的类型：

| 内容 | 说明 |
|---|---|
| 实验室（`Lab`） | PRD §13.2 有字段清单，但 C 的首批数据只有导师。是否纳入由 C 决定 |
| 科研比赛、论文训练、科研简历、成长档案 | 属 P1/P2（PRD §6.2、§6.3），不阻塞 P0 |
| 错误码的细分枚举 | 先按上表，出现真实场景再补 |

---

## 六、改契约的流程

1. 先改 `*.ts`，**同步改 `samples.ts`**（不改就编译不过，这是刻意的）。
2. 契约字段的增删改属于"其他一切"：走 `dev/<自己>` → PR → 至少 1 人确认。
3. 如果这次改动会影响别人的模块（例如 `profile.interests` 的改动影响 C 的检索），在 PR 里点名说明。
