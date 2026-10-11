/**
 * 科研工具箱的检索与校验纯函数（B 负责）。
 *
 * 和 `resources/catalog.ts` 一个性质：**不读文件、不发请求、不碰环境变量**，
 * 数据由调用方传入，便于脱离网络单测。
 */
import type { ResearchTool, ToolAccess, ToolCategory, ToolLanguage } from "@/contracts";

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  "paper-library": "论文库",
  learning: "学习资料",
  "frontier-news": "前沿资讯",
};

/** 分类展示顺序。 */
export const TOOL_CATEGORY_ORDER: ToolCategory[] = ["paper-library", "learning", "frontier-news"];

export const TOOL_ACCESS_LABELS: Record<ToolAccess, string> = {
  free: "免费",
  freemium: "部分免费",
  paid: "需付费",
};

export const TOOL_LANGUAGE_LABELS: Record<ToolLanguage, string> = {
  zh: "中文",
  en: "英文",
  both: "中英",
};

/** 关键词 + 分类过滤。空白输入返回该分类下全部，保持数据顺序稳定。 */
export function searchTools(
  tools: readonly ResearchTool[],
  options: { query?: string; category?: ToolCategory | "" } = {},
): ResearchTool[] {
  const { query = "", category = "" } = options;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return tools.filter((tool) => {
    if (category && tool.category !== category) return false;
    if (terms.length === 0) return true;
    const haystack = [tool.name, tool.description, ...tool.tags].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** 校验工具数据，返回问题列表；空数组 = 通过。 */
export function validateTools(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["不是对象"];
  const dir = value as { tools?: unknown };
  if (!Array.isArray(dir.tools)) return ["缺少 tools 数组"];

  dir.tools.forEach((entry, index) => {
    const tool = entry as Record<string, unknown>;
    const where = `第 ${index + 1} 条`;
    if (typeof tool?.id !== "string" || tool.id.length === 0) errors.push(`${where} 缺少 id`);
    if (typeof tool?.name !== "string" || tool.name.length === 0) errors.push(`${where} 缺少 name`);
    if (typeof tool?.url !== "string" || !/^https?:\/\//.test(tool.url)) {
      errors.push(`${where} url 不是合法链接`);
    }
    if (typeof tool?.description !== "string" || tool.description.length === 0) {
      errors.push(`${where} 缺少 description`);
    }
    const categories: ToolCategory[] = ["paper-library", "learning", "frontier-news"];
    if (!categories.includes(tool?.category as ToolCategory)) errors.push(`${where} category 非法`);
    const accesses: ToolAccess[] = ["free", "freemium", "paid"];
    if (!accesses.includes(tool?.access as ToolAccess)) errors.push(`${where} access 非法`);
    const languages: ToolLanguage[] = ["zh", "en", "both"];
    if (!languages.includes(tool?.language as ToolLanguage)) errors.push(`${where} language 非法`);
  });

  return errors;
}
