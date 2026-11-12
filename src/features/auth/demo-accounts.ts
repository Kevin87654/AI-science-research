/**
 * ⚠️ 演示期的临时账号（**上线前必须删掉这个文件**）。
 *
 * 现在还没有登录接口，也没有账号表：`public.sessions` 里只有匿名会话的令牌摘要，
 * 没有任何可用来校验"账号 + 密码"的东西（详见 docs 里对数据层的说明）。
 * 这一轮的任务只是把**三条身份入口和两个工作台跑通**，所以先把两个账号写在代码里。
 *
 * 换成真实实现时，需要按下面的对应关系替换（调用点只有 `verifyCredentials` 一个）：
 *
 * | 现在（本文件）                  | 将来                                              |
 * |---------------------------------|---------------------------------------------------|
 * | `DEMO_ACCOUNTS` 常量             | `accounts` 表（id / role / name / password_hash）  |
 * | `verifyCredentials` 明文比较     | 服务端 `POST /api/auth/login`，密码只存 bcrypt 哈希 |
 * | 登录态放 localStorage            | HttpOnly Cookie + `sessions` 表（已有这张表）       |
 *
 * **密码为什么可以明文写在这里**：这两个账号是纯测试账号、不绑定任何真实的人，
 * 而且密码本来就要贴在测试说明里。**但真实账号绝不能沿用这种写法** ——
 * 客户端代码是公开的，任何写进前端的密码都等于公开。
 */
import type { AccountProfile, Role } from "@/contracts";

export interface DemoAccount extends AccountProfile {
  /** 仅演示期：明文密码，真实实现改为服务端哈希校验。 */
  password: string;
}

/** 演示导师账号。学生没有明确导师关系时，「联系导师」默认落到这里。 */
export const DEMO_MENTOR_ID = "T1001";

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "20220001",
    role: "student",
    name: "林知遥",
    affiliation: "深圳大学 · 计算机与软件学院 · 软件工程",
    detail: "2022 级 · 大四",
    password: "student123",
  },
  {
    id: DEMO_MENTOR_ID,
    role: "mentor",
    name: "周启明",
    affiliation: "深圳大学 · 计算机与软件学院",
    detail: "副教授 · 数据挖掘与智能系统",
    password: "mentor123",
  },
];

/** 学号/工号统一按去空白、忽略大小写比较 —— 工号 `T1001` 手打成 `t1001` 不该登不进来。 */
function normalizeId(value: string): string {
  return value.trim().toUpperCase();
}

export function findAccountById(accountId: string): DemoAccount | null {
  const target = normalizeId(accountId);
  if (target.length === 0) return null;
  return DEMO_ACCOUNTS.find((account) => normalizeId(account.id) === target) ?? null;
}

/**
 * 校验账号密码。
 *
 * 失败时**不区分**"账号不存在"与"密码不对"：两种都回同一个结果，
 * 由调用方给同一句提示，避免把"这个账号存在"泄露出去。
 */
export function verifyCredentials(role: Role, accountId: string, password: string): DemoAccount | null {
  const account = findAccountById(accountId);
  if (!account) return null;
  if (account.role !== role) return null;
  if (account.password !== password) return null;
  return account;
}

/** 导师端搜索学生：学号或姓名包含关键词即可。空关键词返回空数组（不是全部学生）。 */
export function searchStudents(keyword: string, limit = 8): DemoAccount[] {
  const target = keyword.trim();
  if (target.length === 0) return [];
  const upper = target.toUpperCase();
  return DEMO_ACCOUNTS.filter((account) => {
    if (account.role !== "student") return false;
    return account.id.toUpperCase().includes(upper) || account.name.includes(target);
  }).slice(0, limit);
}

/** 去掉密码，得到可以放进界面/序列化的档案。 */
export function toProfile(account: DemoAccount): AccountProfile {
  return {
    id: account.id,
    role: account.role,
    name: account.name,
    affiliation: account.affiliation,
    detail: account.detail,
  };
}

/** 登录弹窗里提示"用哪个账号测试"。演示期专用，真实实现时整段删掉。 */
export function demoCredentialHint(role: Role): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.role === role) ?? null;
}
