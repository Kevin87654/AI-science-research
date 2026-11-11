"use client";

/**
 * 未登录（或身份不匹配）时的兜底页。
 *
 * 为什么不直接 `router.replace("/")`：直接把人踢回首页会让人以为"点错了"，
 * 而且在演示时很难说清是"没登录"还是"登录过期"。这里明确说一句缺什么，
 * 并把登录入口直接放在眼前 —— 同一个 `LoginDialog`，登录成功后就地进入。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoLockup } from "@/components/logo";
import type { Role } from "@/contracts";
import { LoginDialog } from "@/features/auth/login-dialog";

const COPY: Record<Role, { role: string; purpose: string }> = {
  student: { role: "学生", purpose: "查看毕业设计的学校节点，并记录你自己的进度。" },
  mentor: { role: "导师", purpose: "搜索学生、组建小组，并查看组内学生的进度。" },
};

export function RoleGate({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const copy = COPY[role];

  return (
    <div className="gate">
      <header className="gate-top container">
        <Link className="workspace-brand" href="/" aria-label="返回身份选择">
          <LogoLockup size={38} />
        </Link>
        <span className="badge gate-badge">毕业设计 · 需要登录</span>
      </header>

      <main id="main-content" className="container role-gate-main">
        <div className="card card-highlight role-gate-card">
          <p className="eyebrow">未登录或身份不匹配</p>
          <h1 className="role-gate-title">这里需要{copy.role}登录</h1>
          <p className="lead">{copy.purpose}</p>
          <div className="form-actions">
            <button className="button" type="button" onClick={() => setOpen(true)}>
              登录
            </button>
            <Link className="button-ghost" href="/">
              返回身份选择
            </Link>
          </div>
        </div>
      </main>

      {open ? (
        <LoginDialog
          role={role}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            // 登录态变化会触发 store 更新，页面自己就切到工作台；这里只需关窗。
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
