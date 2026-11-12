# AI 接入

**状态：已接入 DeepSeek 直连**（2026-11-12 从 CodeBuddy CLI 迁移）。

## 这里有什么

| 文件 | 作用 |
|---|---|
| `config.ts` | 读环境变量：密钥 / 根地址 / 模型 / 超时；**不加载 HTTP 客户端**，给 `/api/ping` 用 |
| `client.ts` | OpenAI 兼容的 `POST /chat/completions` 适配器：超时、并发上限、错误翻译 |
| `assessment-coach.ts` | 自适应测评的"教练"：让模型在候选题目里挑下一题 |
| `qa-answerer.ts` | 科研问答的 AI 实现：规则选证据 → 模型组织 → 输出校验 → 失败回落 |
| `spark-analyzer.ts` | 奇思妙想：自由文本 → 亮点 + 兴趣方向 |
| `entry-route-planner.ts` | 入门前置路线：兴趣方向 → 领域导览 |
| `graduation-coach.ts` | 毕设进度提醒 + 阶段性成果汇总（学生端） |

## 配置

| 变量 | 说明 |
|---|---|
| `SERVER_AI_API_KEY` | 服务端专用，绝不进浏览器 / 日志 / 错误信息 |
| `SERVER_AI_BASE_URL` | OpenAI 兼容根地址，默认 `https://api.deepseek.com` |
| `SERVER_AI_MODEL` | 默认 `deepseek-flash`；需要更强生成可换 `deepseek-v4-pro` |
| `SERVER_AI_TIMEOUT_MS` | 单次超时，默认 60000 |
| `SERVER_AI_DEBUG` | 设为 1 才把上游错误详情打进服务端日志 |

真实值只放 `.env.local` 或部署平台。`.env.example` 里只有空值。

## 两条硬约束

1. **模型不参与打分。** 测评里它只决定"下一题问什么"；维度得分、阶段判定、画像生成
   全部由 `src/features/assessment` 的确定性纯函数完成。
2. **降级永远可用。** 没配密钥、超时、返回非法结构，一律退回规则实现
   （测评 `planNextQuestion`、问答 `answerQuestion`、毕设提醒 `buildRuleReminder`）。
   用户不会因为模型挂了而卡住。

## 与旧实现（CodeBuddy CLI）的差别

| | 旧：`@tencent-ai/agent-sdk` | 新：DeepSeek 直连 |
|---|---|---|
| 调用方式 | spawn 一个 CLI 子进程 | 一次 HTTPS `fetch` |
| 固定开销 | 约 13～15 秒启动 | 无（短问答实测约 1 秒） |
| 部署要求 | `serverExternalPackages` + CLI 目录随包投递 + 可写 HOME | 只需一个环境变量 |
| 失败码 | `not_configured / timeout / empty / busy / failed` | 保持不变，调用方无需改判据 |

`next.config.ts` 里为 SDK 加的两项配置已删除。

## JSON 输出

`askText(prompt, { json: true })` 会带上 `response_format: { type: "json_object" }`，
但**只保证"像个 JSON"**，不保证字段齐全或内容可信。每个调用方仍必须走自己的纯函数校验
（`parseSparkAnalysis`、`finalizeAiAnswer`、`parseReminderDraft`…），校验不过就降级。
