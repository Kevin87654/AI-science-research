# AI 接入

**状态：已接入**（2026-09-21，B 模块的自适应测评第一个用到）。

## 这里有什么

| 文件 | 作用 |
|---|---|
| `codebuddy.ts` | CodeBuddy Agent SDK（`@tencent-ai/agent-sdk`）适配器：超时、环境变量映射、错误翻译 |
| `assessment-coach.ts` | 自适应测评的"教练"：让模型在候选题目里挑下一题，并写一句衔接 |

## 两条硬约束

1. **模型不参与打分。** 它只决定"下一题问什么"。维度得分、阶段判定、画像生成全部由
   `src/features/assessment` 里的确定性纯函数完成 —— PRD 要求评分可解释、可复现，
   交给模型会让同一份答案在两次运行里得出不同结论，也无法向学生解释。
2. **降级永远可用。** 没配密钥、超时、返回非法题号，一律退回规则选题
   （`src/features/assessment/next-question.ts`）。用户不会因为模型挂了而卡住。

## 必须保留的配置

- `SERVER_CODEBUDDY_API_KEY`：只有服务端能读，绝不进浏览器、日志或错误信息。
- `next.config.ts` 里的 `serverExternalPackages` 与 `outputFileTracingIncludes`：
  SDK 会 spawn 自带的 CLI 子进程，**不能被打包**，且 CLI 目录要随函数包一起投递。
  这两条来自 `agent-vercel-probe` 的实测，缺一不可。
- Vercel 上还要把 `HOME` / `TMPDIR` / `XDG_CONFIG_HOME` 指到 `/tmp`（已在适配器里处理）。

## 性能实测（2026-09-21，本机）

| 场景 | 耗时 |
|---|---|
| 短提问（"只回复两个字"） | 12.8～15.3 秒 |
| 本题这种带 JSON 约束的提问 | 26.7～45.8 秒 |

其中 **约 13～15 秒是 CLI 子进程的固定启动开销，与提问长短无关**。
所以控制 AI 调用次数的开关（`SERVER_AI_STEP_MODE`）不是优化，而是可用性前提：
每题都调的话，一场测评光等待就 3～5 分钟。详见 `.env.example` 的说明。

## 工具权限

适配器显式传 `allowedTools: []` + `maxTurns: 1`：分析作答只需要"读一段 JSON、写一段 JSON"，
**不给任何文件或命令工具**。后续要放行工具时必须逐个审查，不要整体放开。
