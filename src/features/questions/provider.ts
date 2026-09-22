/**
 * 问答端口（C 模块，**纯逻辑，不含 server-only**）。
 *
 * 这里定义的是**接口**，不是唯一的实现。规则实现（本文件）和 AI 实现
 * （`@/server/ai/qa-answerer`，下一步接入）都实现同一个 `QaProvider`；
 * 上层页面与 Action 不需要知道这条回答是规则给的还是模型给的 ——
 * 只看 `Answer.provenance` 就够了。
 *
 * 规则实现同时是 **AI 失效时的降级实现**，所以它有三条硬要求：
 * 不联网、不依赖密钥、不会超时。
 *
 * ## 两道数据隔离，缺一不可
 *
 * 1. **入口深拷贝**：构造时 `structuredClone` 一份快照。调用方之后怎么改自己那份数据，
 *    都不会影响已经建好的 provider（`tests/provider` 里有一条用例专门盯这个）。
 * 2. **出口深拷贝**：每次 `answer()` 返回前再 `structuredClone` 一次。
 *
 * 第 2 条对应《C模块Demo复测与下一轮交付》§接入时先补两项 的第 2 点：
 * 原实现把内部数组的引用直接返回，调用方往 `actions` 里 push 一项，
 * 下次问同一条 FAQ 就会多出那一项。`@/features/questions/engine` 已经改成返回新数组，
 * 这里再做一次深拷贝是**第二道防线** —— 引用泄漏只要发生一次就会污染所有后续回答，
 * 它不报错、只让内容变形，是最难查的一类问题。
 */
import type { Answer, Catalog, Knowledge } from "@/contracts";

import { deepFreeze } from "../resources/deep-freeze.ts";
import { validateDataset } from "../resources/validate-dataset.ts";
import { answerQuestion } from "./engine.ts";

export type QaProviderKind = "curated-rules" | "codebuddy-ai";

/**
 * 问答能力的统一出口。
 *
 * 返回 `Promise` 而不是同步值，是因为 AI 实现天然异步 ——
 * 若规则实现写成同步，接入 AI 时所有调用点都要改一遍。
 */
export interface QaProvider {
  readonly kind: QaProviderKind;
  answer(question: string): Promise<Answer>;
}

/**
 * 规则问答实现。资料不合格时**直接抛错**，不静默降级成"空目录" ——
 * 一个查不到任何老师的目录比一个明确的报错更难排查。
 */
export function createCuratedProvider(catalog: Catalog, knowledge: Knowledge): QaProvider {
  const errors = validateDataset(catalog, knowledge);
  if (errors.length > 0) {
    throw new Error(`Invalid trusted dataset: ${errors.join("; ")}`);
  }

  const snapshot = deepFreeze(structuredClone({ catalog, knowledge }));

  return Object.freeze({
    kind: "curated-rules" as const,
    async answer(question: string): Promise<Answer> {
      return structuredClone(answerQuestion(question, snapshot.catalog, snapshot.knowledge));
    },
  });
}
