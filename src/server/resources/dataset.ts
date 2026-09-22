import "server-only";

/**
 * 可信资料集的加载与校验（C 模块，服务端）。
 *
 * 数据来自 `data/*.json`（产品资产，会被人工编辑），类型来自 `@/contracts`。
 * JSON 导入在类型层面只是"长得像"，因此**必须过一遍 `validateDataset` 才允许当契约用** ——
 * 这正是那个函数存在的理由：把编译期管不到的运行时数据挡在业务之前。
 *
 * 为什么是**懒加载 + 抛错**而不是模块顶层直接 throw：
 * 顶层 throw 会让**整站**在启动时挂掉，包括和我们无关的路由。改成首次取用时校验，
 * 报错只出现在真正用到 C 资料的地方，并且能把"哪几条数据不合格"一次性带出来。
 */
import type { Catalog, Knowledge } from "@/contracts";
import { deepFreeze } from "@/features/resources/deep-freeze";
import { validateDataset } from "@/features/resources/validate-dataset";

import catalogJson from "../../../data/szu-teachers.json";
import knowledgeJson from "../../../data/research-faq.json";

export interface TrustedDataset {
  readonly catalog: Catalog;
  readonly knowledge: Knowledge;
}

let cached: TrustedDataset | null = null;

/** 取可信资料集。首次调用时校验并冻结；校验不过就抛，带着全部问题一起抛。 */
export function loadDataset(): TrustedDataset {
  if (cached) return cached;

  const errors = validateDataset(catalogJson, knowledgeJson);
  if (errors.length > 0) {
    throw new Error(`可信资料集校验未通过（${errors.length} 项）：${errors.join("；")}`);
  }

  cached = deepFreeze({
    catalog: catalogJson as unknown as Catalog,
    knowledge: knowledgeJson as unknown as Knowledge,
  });
  return cached;
}

/** 只校验、不缓存，供自检接口与测试使用。 */
export function inspectDataset(): { ok: boolean; errors: string[] } {
  const errors = validateDataset(catalogJson, knowledgeJson);
  return { ok: errors.length === 0, errors };
}
