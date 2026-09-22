import "server-only";

/**
 * 服务端问答组装（C 模块）。
 *
 * 这个文件只做一件事：**把仓库内置的资料接上问答端口**。
 * 端口定义与规则实现都在 `@/features/questions/provider`（纯逻辑、可单测），
 * 这里保持薄，是为了让"换数据源"和"换实现"互不影响。
 *
 * ## 接入顺序与降级
 *
 * 目标形态是 **AI 优先 → 规则兜底**：
 *
 * ```
 * createQaProvider()
 *   ├─ isAiConfigured() ? 用 codebuddy 适配器回答
 *   └─ 否则 / 失败 / 超时 / 校验不过 → 规则 provider
 * ```
 *
 * ⚠️ **当前只返回规则 provider**：`@/server/ai/qa-answerer` 尚未实现，属下一轮。
 * 之所以现在就把函数名与降级链条定下来，是因为调用方（Route Handler）不该在
 * "接 AI"那天跟着改一遍。
 *
 * ## 为什么缓存
 *
 * provider 构造时要跑一遍资料集校验 + `structuredClone` + 深冻结，几十毫秒起步。
 * 它是**无状态且不可变**的，缓存完全安全；否则每个请求都白跑一次。
 * （Serverless 上每个实例各有一份缓存，这不影响正确性。）
 */
import type { QaProvider } from "@/features/questions/provider";
import { createCuratedProvider } from "@/features/questions/provider";

import { loadDataset } from "./dataset";

export type { QaProvider, QaProviderKind } from "@/features/questions/provider";

/** 规则 provider 的单一实例。资料不合格时构造会抛错，不静默降级成"空目录"。 */
let curatedSingleton: QaProvider | null = null;

function curatedProvider(): QaProvider {
  if (!curatedSingleton) {
    const { catalog, knowledge } = loadDataset();
    curatedSingleton = createCuratedProvider(catalog, knowledge);
  }
  return curatedSingleton;
}

/**
 * 取当前可用的问答能力。
 *
 * 现阶段恒为规则实现；接入 AI 后这里改成"AI 优先 + 规则兜底"，
 * 调用方只需读 `result.decidedBy` 决定界面怎么标注。
 */
export function createQaProvider(): QaProvider {
  return curatedProvider();
}

/** 供自检接口使用：当前这条链路是规则还是 AI。 */
export function activeQaProviderKind(): QaProvider["kind"] {
  return curatedProvider().kind;
}
