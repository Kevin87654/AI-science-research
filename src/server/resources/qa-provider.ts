import "server-only";

/**
 * 服务端问答组装（C 模块）。
 *
 * 这个文件只做一件事：**把仓库内置的资料接上问答端口**。
 * 端口定义与两种实现都在 `@/features/questions/provider`（纯逻辑、可单测），
 * AI 那一半在 `@/server/ai/qa-answerer`。这里保持薄，是为了让
 * "换数据源"和"换实现"互不影响。
 *
 * ## 组合方式
 *
 * ```
 * createQaProvider()
 *   └─ createAiFirstProvider
 *        ├─ AI 成功        → decidedBy = "ai"
 *        └─ 失败/超时/无证据/未配密钥/开关 off → 规则回答，decidedBy = "rules"
 * ```
 *
 * ⚠️ **`decidedBy` 由每条回答自己带**，不是从这个 provider 的 `kind` 推出来的。
 * 组合 provider 挂的是 AI，但回落时那条回答确实是规则给的 —— 界面必须如实标注。
 *
 * ## 为什么缓存
 *
 * provider 构造时要跑一遍资料集校验 + `structuredClone` + 深冻结，几十毫秒起步。
 * 它**无状态且不可变**，缓存完全安全；否则每个请求都白跑一次。
 * （Serverless 上每个实例各有一份缓存，不影响正确性。）
 */
import { createAiFirstProvider, createCuratedProvider, type QaProvider } from "@/features/questions/provider";
import { createQaAiAnswerer } from "@/server/ai/qa-answerer";

import { loadDataset } from "./dataset";

let singleton: QaProvider | null = null;

/** 取当前可用的问答能力。资料不合格时构造会抛错，不静默降级成"空目录"。 */
export function createQaProvider(): QaProvider {
  if (!singleton) {
    const { catalog, knowledge } = loadDataset();
    singleton = createAiFirstProvider({
      ai: createQaAiAnswerer(catalog, knowledge),
      fallback: createCuratedProvider(catalog, knowledge),
    });
  }
  return singleton;
}

export type { QaProvider, QaProviderKind } from "@/features/questions/provider";
