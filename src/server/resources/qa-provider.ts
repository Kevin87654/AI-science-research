import "server-only";

/**
 * 服务端问答组装（C 模块）。
 *
 * 这个文件只做一件事：**把仓库内置的资料接上问答端口**。
 * 端口定义与规则实现都在 `@/features/questions/provider`（纯逻辑、可单测），
 * 这里保持薄，是为了让"换个数据源"和"换个实现"互不影响。
 *
 * 接入 AI 时（`@/server/ai/qa-answerer`）会在这里加一个带降级的组装函数：
 * AI 失败 → 规则 provider，规则 provider 永远可用。
 */
import type { QaProvider } from "@/features/questions/provider";
import { createCuratedProvider } from "@/features/questions/provider";

import { loadDataset } from "./dataset";

export type { QaProvider, QaProviderKind } from "@/features/questions/provider";

/** 从仓库内置数据集构造规则 provider。资料不合格时抛错。 */
export function createDefaultCuratedProvider(): QaProvider {
  const { catalog, knowledge } = loadDataset();
  return createCuratedProvider(catalog, knowledge);
}
