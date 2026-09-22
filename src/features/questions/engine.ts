/**
 * 科研问答的规则引擎（C 模块）。
 *
 * 迁移自 C 模块 demo（`member-c/src/engine.mjs` 的问答部分）。它和 `@/features/resources/catalog`
 * 一样是**纯函数**：不读文件、不发请求，数据由调用方传入，便于脱离网络做单测。
 *
 * ## 本轮修掉的两个问题（来自《C模块Demo复测与下一轮交付》§接入时先补两项）
 *
 * 1. **否定意图不识别**（原实现）：输入「我不想研究知识图谱，有哪些老师？」会被当成
 *    正向检索，照样返回张昊迪。现在改为识别排除意图并返回**范围提示**，不返回任何匹配结果。
 *    为什么是"提示"而不是"真做排除检索"：复测文档明确要求"先追问或返回范围提示"，
 *    在规则层假装能做排除，比诚实说明边界更容易误导用户。
 *
 * 2. **返回的数组会被调用方污染**（原实现）：`getFaqAnswer` 直接把 `faq.actions` 这个
 *    **内部数组的引用**返回出去，调用方 push 一下，下次问同一条 FAQ 就多出一项。
 *    现在所有对外返回的数组都是新数组（`[...]`）。服务端还有第二道防线：
 *    `@/server/resources/curated-provider` 会先深冻结数据快照、再对每次返回值做深拷贝。
 *
 * ## 三条不变的产品约束
 *
 * - `status` 表达的是**证据覆盖程度**，不是模型置信度；
 * - 不猜名额、不评人品、不编造事实，命中这类问题一律降级并给出官方核验路径；
 * - `provenance` 必须说明这条回答是怎么产生的（规则命中 / 目录检索 / 降级）。
 */
import type { Answer, Catalog, Knowledge, Source } from "@/contracts";
// 相对路径 + `.ts` 后缀：让 `pnpm test` 的 node --test 能直接加载（纯函数要能脱离 Next 验证）。
import {
  DIRECTION_ALIASES,
  allDirections,
  normalizeKeyword,
  searchTeachers,
  sourceRegistry,
  unique,
} from "../resources/catalog.ts";

/** 问题长度上限。超出说明用户把一整段话倒进来了，回答质量无法保证。 */
const MAX_QUESTION_LENGTH = 500;

const NO_MATCH_LIMITATION = "未覆盖信息不等于不存在；系统没有进行实时全网检索。";

/** 统一兜底回答。所有"无法确认"的出口都走这里，保证文案与字段形状一致。 */
export function unknownAnswer(
  message = "已有资料无法确认这个问题。当前支持教师方向查询、公开邮箱和科研入门常见问题。",
): Answer {
  return {
    mode: "fallback",
    status: "unknown",
    heading: "需要进一步确认",
    answer: message,
    actions: [
      "尝试输入具体教师姓名或研究方向，或选择下方常见问题。",
      "涉及招募名额与截止日期时，请查看最新官方通知或向老师本人确认。",
    ],
    citations: [],
    teacherIds: [],
    limitation: NO_MATCH_LIMITATION,
    provenance: "范围提示，无事实推断。",
  };
}

/**
 * 排除 / 否定意图的词表。
 *
 * ⚠️ 刻意**不收单字「别」** —— 它会命中「区别」「特别」「分别」，误伤面太大。
 * 只收明确的否定说法，宁可漏掉个别口语表达，也不要让正常提问被降级。
 */
const EXCLUSION_PATTERNS: readonly RegExp[] = [
  /不想/,
  /不想要/,
  /不要/,
  /不感兴趣/,
  /没(有)?兴趣/,
  /不打算/,
  /不考虑/,
  /不搞/,
  /别推荐/,
  /别找/,
  /排除/,
  /剔除/,
  /去掉/,
  /除开/,
  /除了/,
];

/** 「这看起来是一个找老师/找方向的请求」的信号词。 */
const SEARCH_INTENT_PATTERN = /老师|教师|导师|实验室|研究组|有哪些|哪个|找谁|推荐|领域|方向/;

/**
 * 是否应当回一条"暂不支持排除条件"的范围提示。
 *
 * 两个条件同时成立才算：**有否定说法** + **看起来是在找资源**。
 * 后者是为了避免误伤 —— 例如「姚俊梅不考虑本科生吗？」虽然含「不考虑」，
 * 但它是在问招募情况，不属于排除检索，应当走正常的教师问答。
 */
export function hasExclusionIntent(question: string, catalog: Catalog): boolean {
  const normalized = normalizeKeyword(question);
  if (!EXCLUSION_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (SEARCH_INTENT_PATTERN.test(normalized)) return true;

  // 没有"找资源"的信号词时，再看有没有提到目录里的真实方向。
  return allDirections(catalog.teachers).some((direction) => hasTerm(normalized, direction));
}

/** 排除意图的范围提示。它是**能力边界说明**，不是事实结论，所以不带任何引用。 */
export function exclusionNoticeAnswer(): Answer {
  return {
    mode: "fallback",
    status: "limited",
    heading: "暂不支持排除条件检索",
    answer:
      "规则检索目前只按正向条件工作，还不能处理「不想研究某个方向」这类排除说法。请直接告诉我想了解的方向或教师姓名，我再帮你找。",
    actions: [
      "换成正向说法再问一次，例如「有哪些研究知识图谱的老师」。",
      "或者从方向列表里挑一个你感兴趣的。",
    ],
    citations: [],
    teacherIds: [],
    limitation: "本条没有检索任何资料，因此不涉及事实结论；只是说明当前能力的边界。",
    provenance: "否定/排除意图的范围提示，未做事实推断。",
  };
}

/** 子串命中；纯英文词要求整词匹配，避免 `cv` 命中 `pvc` 这类误判。 */
function hasTerm(text: string, term: string): boolean {
  const word = normalizeKeyword(term);
  if (/^[a-z]+$/.test(word)) return new RegExp(`(^|[^a-z])${word}($|[^a-z])`, "u").test(text);
  return text.includes(word);
}

/**
 * 按 id 取一条策展 FAQ 回答。
 *
 * 返回值里的 `actions` / `citations` / `teacherIds` **都是新数组** —— 见文件头 §2。
 * 引用必须能在来源注册表里全部还原，缺一条就整条降级，绝不用不完整的来源作答。
 */
export function getFaqAnswer(id: string, catalog: Catalog, knowledge: Knowledge): Answer {
  const faq = knowledge.faqs.find((item) => item.id === id);
  if (!faq) return unknownAnswer("没有找到这个常见问题。");

  const registry = sourceRegistry(catalog, knowledge);
  const resolved = faq.sourceIds.map((sourceId) => registry.get(sourceId));
  // `Array.prototype.some` 不会收窄类型，所以用类型守卫再过滤一次：
  // 只要有一条引用还原不出来，就整条降级 —— 宁可不回答，也不给出无法核对的出处。
  const citations = resolved.filter((source): source is Source => source !== undefined);
  if (citations.length !== faq.sourceIds.length) {
    return unknownAnswer("这条回答的来源不完整，请先核验资料。");
  }

  return {
    mode: "curated",
    status: "supported",
    heading: faq.question,
    answer: faq.answer,
    actions: [...faq.actions],
    citations,
    teacherIds: [],
    limitation: faq.limit,
    provenance: "已整理的常见问题回答；行动建议由产品编辑编写，非实时 AI 生成。",
  };
}

/**
 * 规则问答主入口。
 *
 * 判定顺序是有意为之，改动前先想清楚会不会让某类问题落到更差的出口：
 *
 * 1. 入参校验 → 2. 人品/避雷 → 3. 代写与提示注入 → 4. **排除意图**
 * → 5. 名额/截止/最新成果（永远降级，但保留官方入口）→ 6. 指名教师
 * → 7. 完全匹配的 FAQ → 8. 方向标签检索 → 9. FAQ 关键词召回 → 10. 兜底
 *
 * 第 4 步排在第 5 步之前：排除意图是**意图层面**的信号，一旦命中就不该继续做任何匹配。
 * 第 6 步排在 FAQ 之前：问了具体的人就不要拿别人的 FAQ 回答 —— 这是原来就有的约定。
 */
export function answerQuestion(question: unknown, catalog: Catalog, knowledge: Knowledge): Answer {
  if (typeof question !== "string" || !question.trim()) return unknownAnswer("请先输入一个问题。");
  if (question.length > MAX_QUESTION_LENGTH) {
    return unknownAnswer(`问题过长，请缩短到${MAX_QUESTION_LENGTH}字以内，聚焦一个问题。`);
  }

  const q = normalizeKeyword(question);

  if (/人品|避雷|黑料|是不是人类|压榨|人渣|最好.*导师|导师.*最好/.test(q)) {
    return unknownAnswer(
      "公开资料不能支持对导师人品的判断。你可以比较研究方向，并当面确认指导频率、任务安排和参与要求。",
    );
  }

  if (/代写|伪造|编造|虚构|忽略.*规则|ignore.*instruction|system prompt|系统提示词/.test(q)) {
    return unknownAnswer(
      "当前模块只查询已核验资料和科研入门内容，不提供虚构成果、论文代写或无来源的事实。",
    );
  }

  if (hasExclusionIntent(question, catalog)) return exclusionNoticeAnswer();

  const named = catalog.teachers.filter((teacher) => q.includes(normalizeKeyword(teacher.name)));

  if (/名额|截止|保证|保录|一定能|招生人数|今年.*招|现在.*招|目前.*招|最新论文|最新成果/.test(q)) {
    const result = unknownAnswer(
      "已有教师介绍不能确认当前名额、截止时间、最新成果或录取结果，请以最新官方通知和老师本人回复为准。",
    );
    return {
      ...result,
      citations: named.map((teacher) => teacher.source),
      teacherIds: named.map((teacher) => teacher.id),
    };
  }

  // 指名提问要在通用 FAQ 之前解决：不能拿别人的问题回答这个人。
  if (named.length > 0) {
    const exactName = named.length === 1 && q === normalizeKeyword(named[0].name);
    const hasFollowUp = /研究|方向|介绍|资料|邮箱|联系|本科生|招募|招收|招不招/.test(q);
    if (!exactName && !hasFollowUp) return unknownAnswer();

    const contact = /邮箱|联系/.test(q);
    const recruitment = /本科生|招募|招收|招不招/.test(q);

    const text = named
      .map((teacher) => {
        if (contact) return `${teacher.name}（${teacher.college}）：官网列示工作邮箱为 ${teacher.publicEmail}。`;
        if (recruitment) return `${teacher.name}（${teacher.college}）：${teacher.recruitment.note}`;
        return `${teacher.name}（${teacher.college}）：公开方向包括${teacher.directions.join("、")}。`;
      })
      .join("\n");

    return {
      mode: "directory",
      status: recruitment ? "limited" : "supported",
      heading: contact ? "公开联系信息" : recruitment ? "官网中的参与说明" : "教师公开方向",
      answer: text,
      actions: ["打开对应官方介绍核对当前信息。", "准备一个具体研究问题及真实经历，再自行联系。"],
      citations: named.map((teacher) => teacher.source),
      teacherIds: named.map((teacher) => teacher.id),
      limitation:
        "同名教师需结合学院区分；这里只查询首批计算机学院样本，职称和邮箱可能更新。",
      provenance: "依据已核验教师资料直接整理，非实时 AI 生成。",
    };
  }

  const exactFaq = knowledge.faqs.find((faq) => normalizeKeyword(faq.question) === q);
  if (exactFaq) return getFaqAnswer(exactFaq.id, catalog, knowledge);

  const tags = unique([
    ...allDirections(catalog.teachers).filter((direction) => hasTerm(q, direction)),
    ...Object.entries(DIRECTION_ALIASES)
      .filter(([key]) => hasTerm(q, key))
      .map(([, value]) => value),
  ]);

  const looksLikeDirectionQuery =
    /老师|教师|导师|实验室|研究组|有哪些|找谁/.test(q) ||
    tags.some((tag) => normalizeKeyword(tag) === q) ||
    Object.keys(DIRECTION_ALIASES).includes(q);

  if (tags.length > 0 && looksLikeDirectionQuery) {
    const found = searchTeachers(catalog.teachers, { interests: tags })
      .filter((match) => match.matchedTags.length > 0)
      .slice(0, 5);
    if (found.length === 0) return unknownAnswer();

    return {
      mode: "directory",
      status: "limited",
      heading: "可进一步了解的教师",
      answer: found
        .map(({ teacher, matchedTags }) => `${teacher.name}：匹配到${matchedTags.join("、")}。`)
        .join("\n"),
      actions: ["打开一位教师详情，核对方向及资料日期。", "读一篇相关成果的摘要，写下想继续了解的问题。"],
      citations: found.map((match) => match.teacher.source),
      teacherIds: found.map((match) => match.teacher.id),
      limitation:
        "只按已收录的方向标签匹配，最多展示5项，不代表全校名单、优劣排序或招募承诺。",
      provenance: "公开研究方向 + 可解释标签规则。",
    };
  }

  const candidates = knowledge.faqs
    .map((faq) => ({ faq, hits: faq.triggers.filter((trigger) => hasTerm(q, trigger)) }))
    .filter((candidate) => candidate.hits.length > 0)
    .sort(
      (a, b) =>
        Math.max(...b.hits.map((hit) => hit.length)) - Math.max(...a.hits.map((hit) => hit.length)),
    );

  if (candidates.length > 0) {
    const result = getFaqAnswer(candidates[0].faq.id, catalog, knowledge);
    return {
      ...result,
      status: "limited",
      limitation: `匹配到相关常见问题，可能未覆盖提问中的所有细节。${result.limitation}`,
    };
  }

  return unknownAnswer();
}
