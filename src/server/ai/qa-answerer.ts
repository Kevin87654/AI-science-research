import "server-only";

/**
 * 科研问答的 AI 实现（C 负责）。
 *
 * 它实现的是「先试 AI、失败回落规则」里的那一半 —— 真正的回落由
 * `@/features/questions/provider` 的 `createAiFirstProvider` 负责。
 *
 * ## 流程（对齐 demo 的《AI问答提示词草案》）
 *
 * ```
 * ① 规则引擎先跑一遍        →  选证据 + 安全判定（人品/代写/名额/否定意图）
 * ② 没有证据就到此为止      →  返回 null，不调模型（没证据它只能编，还白花额度）
 * ③ 组提示词 → 调模型        →  复用 B 的 askText（唯一适配器，不另起一套）
 * ④ 校验输出 → 拼成 Answer   →  结构 / sourceId / 自造链接 / 证据外教师，四条都要过
 * ⑤ 任何一环不过 → null      →  调用方回落规则回答，用户不会卡住
 * ```
 *
 * ## 为什么让规则引擎先跑（而不是直接把资料全丢给模型）
 *
 * 三个理由，缺一不可：
 *
 * 1. **证据筛选**：模型只能引用我们给它的来源，这样"引用可追溯"才有保证。
 * 2. **安全前置**：问人品、问代写、问名额、否定意图这些出口在规则层就已经被判掉了，
 *    它们不带任何引用 —— 于是"不要叫模型"这件事天然成立，不需要在 AI 层重写一遍政策。
 * 3. **额度**：那些问句恰好是用户最可能反复试的；不叫模型直接把钱省下来了。
 *
 * ## 两条继承自 B 的硬约束
 *
 * - **模型不参与事实判定**：`status` 由模型给，但**引用必须由我们从注册表还原**，
 *   模型只能指认 sourceId；结构不过就整条作废。
 * - **降级永远可用**：没配密钥、超时、并发超限、输出不合格，一律回落规则回答。
 */
import type { Answer, Catalog, Knowledge } from "@/contracts";
import { finalizeAiAnswer, prepareAiInput, resolveQaMode } from "@/features/questions/ai-answer";
import { answerQuestion } from "@/features/questions/engine";

import { askText, isAiConfigured } from "./codebuddy";
import { resolveAiTimeoutMs } from "./config";

/**
 * 问答链路自己的超时**下限**（毫秒）。
 *
 * ⚠️ **实测结论（2026-09-22，本机）**：问答的提示词比测评大得多 ——
 * 里面带着完整证据块（每位教师的科室、方向、招募说明、邮箱、核对日期）加 7 条硬性要求，
 * 而测评的提示词只有题目和选项。沿用测评的 60 秒默认值，**实测第一次调用正好在 60.0 秒被截断**
 * （服务端日志：`超过 60000ms 仍未返回`），随后静默回落规则，用户看到的是"AI 没生效"。
 *
 * 所以这里设的是**下限**而不是默认值：`SERVER_AI_TIMEOUT_MS` 调得比它大就听环境变量的，
 * 调得比它小则不采纳。刻意不让它被调得更短 —— 短了必然降级，那不是"更快"，是"不工作"。
 * 真要把模型整个关掉，用 `SERVER_AI_QA_MODE=off`。
 */
const QA_TIMEOUT_FLOOR_MS = 120_000;

function resolveQaTimeoutMs(): number {
  return Math.max(resolveAiTimeoutMs(), QA_TIMEOUT_FLOOR_MS);
}

/**
 * 造一个注入给 `createAiFirstProvider` 的 AI 函数。
 *
 * 返回 `null` 表示"这次给不出一条可信的 AI 回答"，由调用方回落规则 ——
 * 具体原因只写服务端日志，不返回给用户（模型的失败细节对新生没有意义，
 * 还可能带出请求上下文）。
 *
 * 开关的解析在 `@/features/questions/ai-answer` 的 `resolveQaMode`（纯函数、有测试），
 * 这里只负责把环境变量喂进去。
 */
export function createQaAiAnswerer(
  catalog: Catalog,
  knowledge: Knowledge,
): (question: string) => Promise<Answer | null> {
  return async function answerWithAi(question: string): Promise<Answer | null> {
    if (resolveQaMode(process.env.SERVER_AI_QA_MODE) === "off") return null;
    if (!isAiConfigured()) return null;

    // ① 规则先跑：它负责选证据，也负责把不该答的问题在模型之前就挡掉。
    const baseline = answerQuestion(question, catalog, knowledge);

    // ② 没有证据就别叫模型。这一条同时是额度闸门，见文件头 §2、§3。
    const prepared = prepareAiInput(question, baseline, catalog, knowledge);
    if (!prepared) {
      console.error("[ai] 问答走规则：本次没有可依据的证据");
      return null;
    }

    // ③ 调模型（唯一适配器是 B 的 askText；并发上限在那里处理，超时按问答的量级传）。
    const result = await askText(prepared.prompt, { timeoutMs: resolveQaTimeoutMs() });
    if (!result.ok) {
      console.error(`[ai] 问答降级为规则：code=${result.code}`);
      return null;
    }

    // ④ 校验 + 拼接。`finalizeAiAnswer` 只接受能过全部拒绝规则的输出。
    const answer = finalizeAiAnswer(result.text, prepared, baseline, catalog);
    if (!answer) {
      // 判不出原因会很难查：模型输出与提示词要求不一致是**最常见**的失败，
      // 而它不报错、只表现为"AI 从不接管"。所以按 B 在 codebuddy.ts 里的同一套约定，
      // 只在 SERVER_AI_DEBUG=1 时打出原文（默认关闭：模型输出可能带请求上下文）。
      if (process.env.SERVER_AI_DEBUG === "1") {
        console.error(
          `[ai] 模型输出未过校验 len=${result.text.length} text=${JSON.stringify(result.text.slice(0, 800))}`,
        );
      } else {
        console.error("[ai] 问答降级为规则：输出未通过校验（加 SERVER_AI_DEBUG=1 看原文）");
      }
      return null;
    }

    console.error(`[ai] 问答由模型回答 耗时=${result.durationMs}ms 引用=${answer.citations.length}`);
    return answer;
  };
}
