/**
 * 问答端口（C 模块，**纯逻辑，不含 server-only**）。
 *
 * 这里定义的是**接口**，不是唯一的实现。规则实现（本文件）和 AI 实现
 * （`@/server/ai/qa-answerer`）都实现同一个 `QaProvider`。
 *
 * 规则实现同时是 **AI 失效时的降级实现**，所以它有三条硬要求：
 * 不联网、不依赖密钥、不会超时。
 *
 * ## 为什么 `answer()` 返回的不是 `Answer` 而是 `QuestionResult`
 *
 * 因为**「这个 provider 是谁」和「这条回答是谁给的」是两件事**。
 *
 * 组合 provider 挂的是 AI，但 AI 超时、返回非法结构、或证据不足时它会回落规则 ——
 * 那一条回答就是规则给的。如果接口只暴露一个静态的 `kind`，调用方只能照 `kind` 标注，
 * 于是**一条规则回答会被标成"模型生成"**，或者反过来。
 *
 * 这不是措辞问题：契约里写死了"模型给出的回答必须与规则回答在界面上可区分"。
 * 所以让每条回答自己带上 `decidedBy`，静态的 `kind` 只留给运维排查用（例如自检接口）。
 *
 * ## 两道数据隔离，缺一不可
 *
 * 1. **入口深拷贝**：构造时 `structuredClone` 一份快照，调用方之后怎么改自己那份数据都不影响它。
 * 2. **出口深拷贝**：每次 `answer()` 返回前再 `structuredClone` 一次。
 *
 * 第 2 条对应《C模块Demo复测与下一轮交付》§接入时先补两项 的第 2 点：原实现把内部数组的引用
 * 直接返回，调用方 push 一下，下次问同一条 FAQ 就会多出一项。引擎层已改成返回新数组，
 * 这里是**第二道防线** —— 引用泄漏只要发生一次就会污染所有后续回答，
 * 它不报错、只让内容变形，是最难查的一类问题。
 */
import type { Answer, Catalog, Knowledge, QuestionResult } from "@/contracts";

import { deepFreeze } from "../resources/deep-freeze.ts";
import { validateDataset } from "../resources/validate-dataset.ts";
import { answerQuestion } from "./engine.ts";

export type QaProviderKind = "curated-rules" | "codebuddy-ai";

export interface QaProvider {
  /** 这条链路**可能**用到的实现。仅供排查，**不要拿它当回答来源的标注**。 */
  readonly kind: QaProviderKind;
  /** 每条回答自带 `decidedBy`，降级时它会与 `kind` 不同 —— 这是刻意的。 */
  answer(question: string): Promise<QuestionResult>;
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
    async answer(question: string): Promise<QuestionResult> {
      const answer: Answer = structuredClone(
        answerQuestion(question, snapshot.catalog, snapshot.knowledge),
      );
      return { answer, decidedBy: "rules" as const };
    },
  });
}

/**
 * 「先试 AI、失败回落规则」的组合 provider。
 *
 * **AI 实现以函数注入**，而不是在这里直接 import：那个实现要碰 `server-only` 与网络，
 * 而本文件必须能在 `node --test` 里跑。注入之后，"AI 抛异常会不会回落""回落时标注是否正确"
 * 这两件最容易出错的事，可以用一个假的 ai 函数完整验证，不必真的调模型。
 *
 * 回落判据只有一条：`ai()` **返回 `null`** 或**抛异常**。返回 `null` 表示
 * "这次没法给出一条可信的 AI 回答"（证据不足、结构校验不过、超时……），
 * 由 AI 实现自己判断并把原因写进日志。
 */
export function createAiFirstProvider(options: {
  ai: (question: string) => Promise<Answer | null>;
  fallback: QaProvider;
}): QaProvider {
  const { ai, fallback } = options;

  return Object.freeze({
    kind: "codebuddy-ai" as const,
    async answer(question: string): Promise<QuestionResult> {
      try {
        const viaAi = await ai(question);
        // ⚠️ 即使 AI 成功，也过一次 structuredClone：回答里含着引用对象，
        //    不能让调用方拿到与内部快照共享的可变结构。
        if (viaAi) return { answer: structuredClone(viaAi), decidedBy: "ai" as const };
      } catch (error) {
        // 只记错误名，不记 error 本体（可能带请求上下文）。
        const name = error instanceof Error ? error.name : typeof error;
        console.error(`[qa] AI 回答失败，回落规则：name=${name}`);
      }

      // 回落时原样返回规则结果 —— 它自带 decidedBy="rules"，界面会如实标注。
      return fallback.answer(question);
    },
  });
}
