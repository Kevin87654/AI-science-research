"use client";

/**
 * 工作台顶栏：身份 + 账号 + 返回身份选择 / 退出登录。
 *
 * 学生页和导师页共用。刻意**不复用 `SiteHeader`**：
 * 那个顶栏是给科研内容页用的（"开始测评"按钮、当前功能面包屑），
 * 这里要表达的是"你以什么身份、什么账号在看这一页"，两者不是一回事。
 */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LogoMark } from "@/components/logo";
import type { Role } from "@/contracts";
import { signOut } from "@/features/auth/session-store";

export function WorkspaceBar({
  role,
  name,
  accountId,
  detail,
}: {
  role: Role;
  name: string;
  accountId: string;
  detail: string;
}) {
  const router = useRouter();
  const roleName = role === "student" ? "大四学生" : "导师";

  return (
    <header className="workspace-top container">
      <div className="workspace-identity">
        <Link className="workspace-brand" href="/" aria-label="返回身份选择">
          <LogoMark size={38} />
        </Link>
        <div className="workspace-user">
          <span className="workspace-name">
            {name}
            <span className="role-chip">{roleName}</span>
          </span>
          <span className="workspace-meta">
            {accountId}
            {detail ? ` · ${detail}` : ""}
          </span>
        </div>
      </div>

      <div className="workspace-actions">
        <Link className="button-ghost" href="/">
          身份选择
        </Link>
        <button
          className="button-ghost"
          type="button"
          onClick={() => {
            signOut();
            router.replace("/");
          }}
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
