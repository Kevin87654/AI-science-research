import "server-only";

/**
 * 科研工具箱的加载与校验（服务端）。
 *
 * 数据来自 `data/research-tools.json`（产品资产，会被人工编辑），类型来自 `@/contracts`。
 * JSON 导入在类型层面只是"长得像"，因此**必须过一遍 `validateTools` 才允许当契约用** ——
 * 与 `dataset.ts` 同一个理由：把编译期管不到的运行时数据挡在业务之前。
 *
 * 用**懒加载 + 抛错**而不是模块顶层 throw：报错只出现在真正用到工具箱的地方，
 * 不会让整站启动时挂掉。
 */
import type { ToolDirectory } from "@/contracts";
import { deepFreeze } from "@/features/resources/deep-freeze";
import { validateTools } from "@/features/tools/catalog";

import toolsJson from "../../../data/research-tools.json";

let cached: ToolDirectory | null = null;

/** 取工具箱数据。首次调用时校验并冻结；校验不过就抛，带着全部问题一起抛。 */
export function loadToolbox(): ToolDirectory {
  if (cached) return cached;

  const errors = validateTools(toolsJson);
  if (errors.length > 0) {
    throw new Error(`科研工具箱数据校验未通过（${errors.length} 项）：${errors.join("；")}`);
  }

  cached = deepFreeze(toolsJson as unknown as ToolDirectory);
  return cached;
}
