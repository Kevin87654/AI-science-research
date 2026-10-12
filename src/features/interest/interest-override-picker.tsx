"use client";

/**
 * 「对测评结果不满意？」—— 手动补充兴趣方向（B 负责，第三轮新增）。
 *
 * 画像页的「兴趣方向」与学习路线页的「入门前置路线」共用这一个组件：
 * 点开后列出方向目录里**还没出现**的方向，选中后写入共享存储
 * `manualInterests`（`spark/store.ts`）。两个页面订阅的是同一份状态，
 * 所以一处添加、两处同步，不会出现画像里加了、路线里没加上的漂移。
 *
 * 选中的标签 `source` 记为 `user-input`（契约原义：用户自选），
 * 与测评探测 / 奇思妙想推导出的 `derived` 区分开。
 */
import { useState } from "react";

import { addManualInterest } from "@/features/spark/store";
import { INTEREST_DIRECTION_ORDER, INTEREST_DIRECTIONS } from "./directions";

export function InterestOverridePicker({ existingIds }: { existingIds: string[] }) {
  const [open, setOpen] = useState(false);

  const existing = new Set(existingIds);
  const remaining = INTEREST_DIRECTION_ORDER.filter((id) => !existing.has(id));

  return (
    <span className="interest-override">
      <button
        type="button"
        className="chip chip-ghost"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        对测评结果不满意？
      </button>
      {open ? (
        remaining.length > 0 ? (
          <span className="interest-override-options">
            {remaining.map((id) => (
              <button
                key={id}
                type="button"
                className="chip"
                onClick={() => {
                  addManualInterest({ id, label: INTEREST_DIRECTIONS[id], source: "user-input" });
                  // 最后一个方向也被选完时顺手收起，避免留下一个空壳面板。
                  if (remaining.length === 1) setOpen(false);
                }}
              >
                {INTEREST_DIRECTIONS[id]}
              </button>
            ))}
          </span>
        ) : (
          <span className="muted small">所有方向都已在列表里了。</span>
        )
      ) : null}
    </span>
  );
}
