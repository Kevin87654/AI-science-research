"use client";

/**
 * 登录弹窗。
 *
 * 与首页的三张身份卡配合：点「大四学生 / 导师」先弹这个窗，登录成功才进入工作台。
 * 弹窗自身**不做跳转** —— 成功时把 session 交给调用方，由首页决定去哪，
 * 这样同一个弹窗也能被工作台的"请先登录"空状态复用。
 *
 * 表单实现的三点：`noValidate` + 自己给统一文案（不弹浏览器自带的英文气泡）、
 * 失败只显示一句"账号或密码不正确"（不泄露账号是否存在）、Esc 与点遮罩都能关。
 */
import { useEffect, useRef, useState } from "react";

import type { Role } from "@/contracts";
import { demoCredentialHint } from "./demo-accounts";
import { signIn, type StoredSession } from "./session-store";

const COPY: Record<Role, { en: string; title: string; account: string; lead: string }> = {
  student: {
    en: "STUDENT",
    title: "学生登录",
    account: "学号",
    lead: "登录后进入你的毕设进度追踪。",
  },
  mentor: {
    en: "MENTOR",
    title: "导师登录",
    account: "工号",
    lead: "登录后进入导师管理，搜索并添加组内学生。",
  },
};

export function LoginDialog({
  role,
  onClose,
  onSuccess,
}: {
  role: Role;
  onClose: () => void;
  onSuccess: (session: StoredSession) => void;
}) {
  const copy = COPY[role];
  const hint = demoCredentialHint(role);
  const accountRef = useRef<HTMLInputElement | null>(null);

  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = signIn(role, accountId, password);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    onSuccess(outcome.session);
  }

  /** 演示期便利按钮：把测试账号填进表单，省得每次手打。 */
  function fillDemoAccount() {
    if (!hint) return;
    setAccountId(hint.id);
    setPassword(hint.password);
    setError(null);
    accountRef.current?.focus();
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        // 只有点在遮罩本身（不是弹窗内部）时才关闭，避免拖选文字时误关。
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal modal-login"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        aria-describedby="login-lead"
      >
        <p className="login-eyebrow">{copy.en} · 登录</p>
        <h2 className="login-title" id="login-title">
          {copy.title}
        </h2>
        <p className="login-lead" id="login-lead">
          {copy.lead}
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="login-account">
              {copy.account}
            </label>
            <input
              id="login-account"
              ref={accountRef}
              className="field-input"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              autoComplete="username"
              inputMode={role === "student" ? "numeric" : "text"}
              placeholder={role === "student" ? "例如 20220001" : "例如 T1001"}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-password">
              密码
            </label>
            <input
              id="login-password"
              className="field-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="请输入密码"
            />
          </div>

          {error ? (
            <p className="error-text login-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="button" type="submit">
              登录
            </button>
            <button className="button-ghost" type="button" onClick={onClose}>
              取消
            </button>
          </div>
        </form>

        {/*
          演示期专用：登录逻辑还没接服务端，账号固定在 `demo-accounts.ts` 里。
          真实登录上线后连同 `demoCredentialHint` 一起删掉这一段。
        */}
        {hint ? (
          <div className="login-hint">
            <p className="login-hint-title">测试账号（登录实现完成前临时提供）</p>
            <p className="login-hint-line">
              {copy.account} <code>{hint.id}</code> · 密码 <code>{hint.password}</code>
            </p>
            <button className="button-ghost login-hint-fill" type="button" onClick={fillDemoAccount}>
              填入测试账号
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
