"use client";

/**
 * 首页：身份入口。
 *
 * 原来的 `/` 是科研小助理的首页，现在整站从「选身份」开始：
 *   · 大四学生 → 登录 → `/student`（毕设进度追踪，双时间轴）
 *   · 导师     → 登录 → `/mentor`（搜索并添加学生、查看组内进度）
 *   · 科研萌新 → 免登录 → `/assistant`（原来那套测评 / 路线 / 资料 / 问答）
 *
 * 换成「入口页」而不是在原有首页上加三个按钮，是因为**三种身份的下一步完全是三个地方**，
 * 混在一屏里会让第一次来的人不知道该点哪个 —— 与首页原来"先测评"的那条引导思路一致。
 *
 * 已登录用户再点同类卡片时直接进入，不再要求登录一次。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoLockup } from "@/components/logo";
import type { Role } from "@/contracts";
import { LoginDialog } from "@/features/auth/login-dialog";
import { useRoleSession } from "@/features/auth/use-role-session";

interface IdentityCard {
  key: Role | "newcomer";
  index: string;
  title: string;
  en: string;
  /** 部分卡片（如科研萌新）不需要描述文案。 */
  description?: string;
  meta: string[];
  cta: string;
}

const IDENTITIES: readonly IdentityCard[] = [
  {
    key: "student",
    index: "01",
    title: "大四学生",
    en: "GRADUATING STUDENT",
    description: "深大计软学生毕设管理工具入口",
    meta: ["需要登录", "双时间轴", "可自行添加节点"],
    cta: "登录并追踪进度",
  },
  {
    key: "mentor",
    index: "02",
    title: "导师",
    en: "MENTOR",
    description: "课题组学生管理终端入口",
    meta: ["需要登录", "小组管理", "组内进度"],
    cta: "登录并管理学生",
  },
  {
    key: "newcomer",
    index: "03",
    title: "科研萌新",
    en: "NEWCOMER",
    meta: ["无需登录", "原有功能"],
    cta: "直接进入",
  },
];

const ENTRY_PATH: Record<Role, string> = { student: "/student", mentor: "/mentor" };

const ROLE_NAME: Record<Role, string> = { student: "大四学生", mentor: "导师" };

export function IdentityGate() {
  const router = useRouter();
  const session = useRoleSession();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  function enterAs(role: Role) {
    // 已用同一身份登录过就直接进，不再弹一次窗。
    if (session?.role === role) {
      router.push(ENTRY_PATH[role]);
      return;
    }
    setPendingRole(role);
  }

  return (
    <div className="gate">
      <header className="gate-top container">
        <LogoLockup size={40} />
      </header>

      <main id="main-content" className="container gate-main">
        <h1 className="gate-title">选择你的身份</h1>

        {session ? (
          <p className="gate-session">
            当前已登录：<strong>{session.name}</strong>（{ROLE_NAME[session.role]} · {session.accountId}）
            <button
              className="gate-session-link"
              type="button"
              onClick={() => router.push(ENTRY_PATH[session.role])}
            >
              继续进入 →
            </button>
          </p>
        ) : null}

        <div className="gate-grid">
          {IDENTITIES.map((identity) => {
            const role = identity.key;
            const body = (
              <>
                <span className="gate-card-index">{identity.index}</span>
                <span className="gate-card-role">{identity.title}</span>
                <span className="gate-card-en">{identity.en}</span>
                {identity.description ? (
                  <span className="gate-card-desc">{identity.description}</span>
                ) : null}
                <span className="gate-card-meta">
                  {identity.meta.map((item) => (
                    <span className="gate-chip" key={item}>
                      {item}
                    </span>
                  ))}
                </span>
                <span className="gate-card-cta">
                  {identity.cta}
                  <span aria-hidden="true">→</span>
                </span>
              </>
            );

            if (role === "newcomer") {
              return (
                <Link className="gate-card" href="/assistant" key={identity.key}>
                  {body}
                </Link>
              );
            }

            return (
              <button
                className="gate-card"
                key={identity.key}
                type="button"
                onClick={() => enterAs(role)}
              >
                {body}
              </button>
            );
          })}
        </div>

      </main>

      <footer className="container site-footer">科研小助理 · 深圳大学酱味大鸡队呈现</footer>

      {pendingRole ? (
        <LoginDialog
          role={pendingRole}
          onClose={() => setPendingRole(null)}
          onSuccess={(next) => {
            setPendingRole(null);
            router.push(ENTRY_PATH[next.role]);
          }}
        />
      ) : null}
    </div>
  );
}
