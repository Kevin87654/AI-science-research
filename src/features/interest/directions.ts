/**
 * 兴趣方向目录 —— 全站唯一的兴趣方向清单（B 负责，第二轮新增）。
 *
 * 为什么单独抽出来而不是留在 `interest-probe.ts`：
 * 第二轮起兴趣方向不再是测评一个入口的私产 —— 测评开头的启发式探测、
 * 「奇思妙想」的自由文本分析、学习路线的「入门前置路线」三处都要用同一套
 * 方向 id。集中放这里，改一个方向文案、或加一个方向，三处自动同步，
 * 不会出现「测评里叫人工智能、奇思妙想里叫 AI」这种漂移。
 *
 * id 沿用旧 `q-interest` 选项的 id（it-*），供下游刊物 / 论文数据引用，
 * **不要改名**：数据侧（C 的刊物、论文推荐）已经按这些 id 挂了引用。
 */
import type { InterestTag } from "@/contracts";

/** 方向 id → 展示名。 */
export const INTEREST_DIRECTIONS: Record<string, string> = {
  "it-ai": "人工智能",
  "it-robotics": "机器人",
  "it-data": "数据科学",
  "it-bio": "生物医学",
  "it-material": "材料与能源",
  "it-hci": "人机交互",
  "it-security": "网络安全",
};

/** 方向的固定展示顺序（用于去重后保持稳定排序）。 */
export const INTEREST_DIRECTION_ORDER: string[] = [
  "it-ai",
  "it-robotics",
  "it-data",
  "it-bio",
  "it-material",
  "it-hci",
  "it-security",
];

/**
 * 给 AI 用的方向说明，比展示名更具体。
 *
 * 用途：把用户的自由文本（奇思妙想）或兴趣标签，映射到正确的方向 id 时，
 * 模型需要知道「it-material 到底指什么」。展示名「材料与能源」对大一新生
 * 来说太窄，这里补上典型关键词，让映射更稳。
 */
export const INTEREST_DIRECTION_DESCRIPTIONS: Record<string, string> = {
  "it-ai": "人工智能与机器学习：模型、算法、大模型、AIGC、智能系统、深度学习",
  "it-robotics": "机器人与自动化：机器人、自动驾驶、无人机、机电控制、嵌入式",
  "it-data": "数据科学：数据分析、数据挖掘、可视化、推荐系统、统计建模",
  "it-bio": "生物医学与健康：医疗 AI、生物信息、可穿戴健康、药物研发、生命科学",
  "it-material": "材料与能源：新材料、新能源、储能、半导体、电池、碳中和",
  "it-hci": "人机交互与产品：界面设计、用户体验、交互产品、游戏、数字媒体",
  "it-security": "网络安全与隐私：漏洞攻防、加密、隐私保护、系统安全、区块链",
};

/**
 * 方向 id → 兴趣标签。
 *
 * `source` 固定为 `derived`：无论是测评探测还是奇思妙想分析，
 * 都是「从用户的表达里推导出来」，不是用户直接勾选（`user-input`）。
 */
export function toInterestTag(directionId: string): InterestTag | null {
  const label = INTEREST_DIRECTIONS[directionId];
  if (!label) return null;
  return { id: directionId, label, source: "derived" };
}
