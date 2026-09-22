/**
 * 资料集校验（C 模块）。
 *
 * 迁移自 C 模块 demo 的 `validateData`，错误文案保持一致 —— 已有测试按子串断言，
 * 换措辞会让回归失效，也会让《来源与内容维护》里的排错说明对不上。
 *
 * 为什么放在这里而不是只在构建期校验：数据是**产品资产**，会被人手工改。
 * 一旦有人把来源 URL 改成 `javascript:`、删掉一条引用、或给真实教师打上演示标记，
 * 我们希望它在**加载数据集的那一刻就炸**，而不是等到用户提问时给出一条编造的回答。
 *
 * 入参是 `unknown`：它守的是"外部 JSON 的边界"，不能假设形状已经正确。
 */
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** 返回全部问题；空数组表示数据集可用。 */
export function validateDataset(catalog: unknown, knowledge: unknown): string[] {
  const errors: string[] = [];

  const catalogRecord = asRecord(catalog);
  const knowledgeRecord = asRecord(knowledge);
  const teachers = asArray(catalogRecord?.teachers);
  const faqs = asArray(knowledgeRecord?.faqs);
  const sources = asArray(knowledgeRecord?.sources);

  if (!teachers || !faqs || !sources) return ["缺少 teachers / faqs / sources 数组"];

  const sourceIds = new Set<string>();
  const checkSource = (value: unknown): void => {
    const source = asRecord(value);
    const id = asText(source?.id);
    if (!source || !id) {
      errors.push("缺少来源标识");
      return;
    }

    if (sourceIds.has(id)) errors.push(`来源ID重复：${id}`);
    sourceIds.add(id);

    try {
      const url = new URL(asText(source.url) ?? "");
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("untrusted url");
    } catch {
      errors.push(`来源URL无效：${id}`);
    }

    const checkedAt = asText(source.checkedAt);
    if (!checkedAt || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || !Number.isFinite(Date.parse(checkedAt))) {
      errors.push(`核验日期无效：${id}`);
    }

    if (!asText(source.title) || !asText(source.evidenceSummary) || !asText(source.publisher)) {
      errors.push(`来源证据不完整：${id}`);
    }
  };

  const teacherIds = new Set<string>();
  for (const value of teachers) {
    const teacher = asRecord(value);
    const id = asText(teacher?.id) ?? "(未知 id)";
    if (teacherIds.has(id)) errors.push(`教师ID重复：${id}`);
    teacherIds.add(id);

    const directions = asArray(teacher?.directions);
    const complete =
      asText(teacher?.id) !== null &&
      asText(teacher?.name) !== null &&
      asText(teacher?.college) !== null &&
      asText(teacher?.summary) !== null &&
      directions !== null &&
      directions.length > 0;
    if (!complete) errors.push(`教师字段不完整：${id}`);

    checkSource(teacher?.source);

    const sourceRecord = asRecord(teacher?.source);
    const sourceUrl = asText(sourceRecord?.url);
    if (sourceUrl) {
      try {
        // 教师资料只允许引用校内官网；其他域名一律人工复核后再放行。
        if (!new URL(sourceUrl).hostname.endsWith(".szu.edu.cn")) {
          errors.push(`非深大教师来源：${id}`);
        }
      } catch {
        // URL 本身无效的情况已经在 checkSource 里报过，这里不重复。
      }
    }

    if (teacher?.isDemo !== false) errors.push(`真实资料不能标记为演示用户数据：${id}`);
    if (asRecord(teacher?.recruitment)?.currentAvailability !== "unknown") {
      errors.push(`未经确认的实时名额：${id}`);
    }

    const email = asText(teacher?.publicEmail);
    if (email !== null && !/^[^\s@]+@szu\.edu\.cn$/.test(email)) errors.push(`邮箱格式错误：${id}`);

    for (const work of asArray(teacher?.representativeWorks) ?? []) {
      if (asRecord(work)?.sourceId !== asText(sourceRecord?.id)) errors.push(`成果缺少来源：${id}`);
    }
  }

  sources.forEach(checkSource);

  const faqIds = new Set<string>();
  for (const value of faqs) {
    const faq = asRecord(value);
    const id = asText(faq?.id) ?? "(未知 id)";
    if (faqIds.has(id)) errors.push(`问答ID重复：${id}`);
    faqIds.add(id);

    const actions = asArray(faq?.actions);
    const faqSourceIds = asArray(faq?.sourceIds);
    const triggers = asArray(faq?.triggers);
    const complete =
      asText(faq?.answer) !== null &&
      actions !== null &&
      actions.length > 0 &&
      faqSourceIds !== null &&
      faqSourceIds.length > 0 &&
      triggers !== null &&
      triggers.length > 0;
    if (!complete) errors.push(`问答字段不完整：${id}`);

    for (const sourceId of faqSourceIds ?? []) {
      if (typeof sourceId !== "string" || !sourceIds.has(sourceId)) {
        errors.push(`问答引用不存在：${id}/${String(sourceId)}`);
      }
    }
  }

  return errors;
}
