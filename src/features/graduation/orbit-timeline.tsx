"use client";

/**
 * 流态旋转时间轴：把「我的进度」与「学院节点」收进同一块舞台。
 *
 * 布局（PC 为准）：
 *   · 左半场：学生自己记的节点，一屏 3 个，滚轮上下翻看；
 *   · 中间：代表「今天」的黑色星球 + 下一个学院节点提示；
 *   · 右半场：学院统一节点，同样一屏 3 个，滚轮翻看；
 *   · 星球下方：AI 进度助手。
 *
 * 学院节点卡只保留日期 / 状态 / 标题，完整说明与材料清单点开后在浮层里看。
 * 转动只作用于容器（滚动 + 指针视差，≤8°），卡片文字始终正对读者；
 * `prefers-reduced-motion` 下全部退回静态。
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { GraduationMilestone, StudentNode } from "@/contracts";
import { describeDue, formatIsoDate } from "./timeline-meta";

interface OrbitTimelineProps {
  milestones: readonly GraduationMilestone[];
  nodes: readonly StudentNode[];
  /** 本地日期，形如 `2026-11-12`。 */
  today: string;
  /** 下一个还没到期的学院节点，用于星球下方的提示。 */
  next: GraduationMilestone | null;
  /** 由工作台传入的「记录节点」表单；展开后才挂到左半场里。 */
  composer: ReactNode;
  /** 星球下方的 AI 进度助手。 */
  assistant?: ReactNode;
  onRemove: (nodeId: string) => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function badgeState(milestone: GraduationMilestone, today: string) {
  if (!milestone.dueDate) return { className: "orbit-badge-undated", label: "日期待定" };
  const due = describeDue(milestone.dueDate, today);
  return { className: `orbit-badge-${due.state}`, label: due.label };
}

/** 一屏固定 3 张卡：滚轮/方向键按「一张卡」步进，不出现半张卡。 */
const CARD_VISIBLE = 3;

function measureStep(el: HTMLElement): number {
  const first = el.firstElementChild as HTMLElement | null;
  if (!first) return 0;
  const gap = Number.parseFloat(getComputedStyle(el).rowGap) || 0;
  return first.offsetHeight + gap;
}

function CardWindow({
  label,
  count,
  children,
}: {
  label: string;
  /** 参与翻页的卡片总数（学生栏会把「记录下一条」也算一张）。 */
  count: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLOListElement | null>(null);
  const indexRef = useRef(0);
  const maxIndex = Math.max(0, count - CARD_VISIBLE);

  const goTo = useCallback(
    (next: number) => {
      const el = ref.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(maxIndex, next));
      indexRef.current = clamped;
      el.scrollTo({ top: clamped * measureStep(el), behavior: "smooth" });
    },
    [maxIndex],
  );

  // 列表长度变化（增删节点）时把位置夹回合法范围。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clamped = Math.min(indexRef.current, maxIndex);
    indexRef.current = clamped;
    el.scrollTo({ top: clamped * measureStep(el), behavior: "auto" });
  }, [maxIndex]);

  // 滚轮翻页：一次一张卡；到首/尾就交还给页面滚动。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let accumulated = 0;
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (maxIndex === 0) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      const next = indexRef.current + direction;
      if (next < 0 || next > maxIndex) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastStep < 220) return;
      accumulated += event.deltaY;
      if (Math.abs(accumulated) < 70) return;
      accumulated = 0;
      lastStep = now;
      goTo(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [maxIndex, goTo]);

  return (
    <ol
      className="orbit-window"
      ref={ref}
      tabIndex={0}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "PageDown") {
          event.preventDefault();
          goTo(indexRef.current + 1);
        } else if (event.key === "ArrowUp" || event.key === "PageUp") {
          event.preventDefault();
          goTo(indexRef.current - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          goTo(0);
        } else if (event.key === "End") {
          event.preventDefault();
          goTo(maxIndex);
        }
      }}
    >
      {children}
    </ol>
  );
}

export function OrbitTimeline({ milestones, nodes, today, next, composer, assistant, onRemove }: OrbitTimelineProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const selectedIndex = selectedId ? milestones.findIndex((item) => item.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? milestones[selectedIndex] : null;

  const closeDialog = useCallback(() => {
    setSelectedId(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  // 滚动时让整块舞台绕核心轻轻转一点：页面向下滚，左右两栏像被同一条轴带着走。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const rect = stage.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
      stage.style.setProperty("--turn", `${((progress - 0.5) * 8).toFixed(2)}deg`);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  // 指针视差：转到与鼠标位置相反的一点点，产生「这块东西有厚度」的手感。
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    const apply = () => {
      frame = 0;
      stage.style.setProperty("--tilt-x", `${targetY.toFixed(2)}deg`);
      stage.style.setProperty("--tilt-y", `${targetX.toFixed(2)}deg`);
    };
    const onMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = Math.max(-1, Math.min(1, px)) * 3.2;
      targetY = Math.max(-1, Math.min(1, py)) * -2.2;
      if (frame === 0) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  // 详情浮层打开时锁住页面滚动，Esc 关闭，Tab 在浮层内循环；
  // 焦点先进入浮层、关闭后回到触发卡片，避免键盘用户被丢回页首。
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selected, closeDialog]);

  function selectByOffset(offset: number) {
    if (selectedIndex < 0) return;
    const target = milestones[selectedIndex + offset];
    if (!target) return;
    setSelectedId(target.id);
    dialogRef.current?.focus();
  }

  function openComposer() {
    setComposerOpen(true);
    requestAnimationFrame(() => document.getElementById("node-title")?.focus());
  }

  function toggleComposer() {
    if (composerOpen) {
      setComposerOpen(false);
    } else {
      openComposer();
    }
  }

  const nextDue = next?.dueDate ? describeDue(next.dueDate, today) : null;
  const windowHint = "一屏 3 项 · 滚轮翻看";

  return (
    <div className="orbit-stage" ref={stageRef}>
      <div className="orbit-grid">
        <section className="orbit-col orbit-col-mine" aria-labelledby="orbit-mine-title">
          <header className="orbit-col-head">
            <div>
              <p className="orbit-col-kicker">PERSONAL · 自己记录</p>
              <h3 className="orbit-col-title" id="orbit-mine-title">
                我的进度
              </h3>
            </div>
            <button
              className="orbit-add"
              type="button"
              onClick={toggleComposer}
              aria-expanded={composerOpen}
              aria-controls="orbit-composer"
            >
              {composerOpen ? "收起" : "＋ 记录"}
            </button>
          </header>

          <div className="orbit-composer" id="orbit-composer" hidden={!composerOpen}>
            {composer}
          </div>

          {nodes.length === 0 ? (
            <div className="orbit-empty">
              <p className="orbit-empty-title">还没有记录</p>
              <p className="orbit-empty-text">和导师开过会、交了一稿、跑通了实验，都可以记一条。它会落在左边的轨道上。</p>
              <button className="orbit-add" type="button" onClick={openComposer}>
                ＋ 记录第一条
              </button>
            </div>
          ) : (
            <CardWindow
              label={`我的进度，共 ${nodes.length} 条，滚轮翻看`}
              count={nodes.length + 1}
            >
              {nodes.map((node) => (
                <li
                  className="orbit-node"
                  key={node.id}
                  style={{ "--i": 0 } as CSSProperties}
                >
                  <div className="orbit-node-meta">
                    <time className="orbit-node-date" dateTime={node.date}>
                      {formatIsoDate(node.date)}
                    </time>
                    <span className="orbit-node-flag">自己记录</span>
                  </div>
                  <h4 className="orbit-node-title">{node.title}</h4>
                  {node.note ? <p className="orbit-node-note">{node.note}</p> : null}
                  <button
                    className="orbit-node-remove"
                    type="button"
                    onClick={() => onRemove(node.id)}
                    aria-label={`删除节点：${node.title}`}
                  >
                    删除
                  </button>
                </li>
              ))}
              <li className="orbit-node-add-item">
                <button className="orbit-node-add" type="button" onClick={openComposer}>
                  <span className="orbit-node-add-mark" aria-hidden="true">
                    ＋
                  </span>
                  记录下一条
                </button>
              </li>
            </CardWindow>
          )}

          <p className="orbit-window-bar">
            <span>共 {nodes.length} 条</span>
            <span>{windowHint}</span>
          </p>
        </section>

        <div className="orbit-core">
          <div className="orbit-core-visual">
            <div className="orbit-halo" aria-hidden="true" />
            <div className="orbit-rings" aria-hidden="true">
              <span className="orbit-ring orbit-ring-a" />
              <span className="orbit-ring orbit-ring-b" />
              <span className="orbit-ring orbit-ring-c" />
            </div>
            <div className="orbit-orb">
              <span className="orbit-orb-kicker">TODAY</span>
              <span className="orbit-orb-date">{today.split("-").join(" · ")}</span>
            </div>
          </div>
          <p className="orbit-caption">
            <span className="orbit-caption-label">NEXT / 下一个学院节点</span>
            <span className="orbit-caption-value">{next ? next.title : "已无待办节点"}</span>
            {nextDue ? <span className="orbit-caption-due">{nextDue.label}</span> : null}
          </p>

          {assistant ? <div className="orbit-ai">{assistant}</div> : null}
        </div>

        <section className="orbit-col orbit-col-school" aria-labelledby="orbit-school-title">
          <header className="orbit-col-head">
            <div>
              <p className="orbit-col-kicker">ACADEMIC · 学院统一</p>
              <h3 className="orbit-col-title" id="orbit-school-title">
                学院节点
              </h3>
            </div>
            <span className="orbit-col-count">{milestones.length} 项 · 点击查看</span>
          </header>

          <CardWindow
            label={`学院节点，共 ${milestones.length} 项，滚轮翻看`}
            count={milestones.length}
          >
            {milestones.map((milestone, index) => {
              const badge = badgeState(milestone, today);
              const active = milestone.id === selectedId;
              return (
                <li className="orbit-milestone-item" key={milestone.id}>
                  <button
                    className={active ? "orbit-milestone is-active" : "orbit-milestone"}
                    type="button"
                    onClick={(event) => {
                      openerRef.current = event.currentTarget;
                      setSelectedId(milestone.id);
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={active}
                  >
                    <span className="orbit-milestone-index">{pad(index + 1)}</span>
                    <span className="orbit-milestone-main">
                      <span className="orbit-milestone-meta">
                        <span className="orbit-milestone-date">{milestone.dateLabel}</span>
                        <span className={`orbit-badge ${badge.className}`}>{badge.label}</span>
                      </span>
                      <span className="orbit-milestone-title">{milestone.title}</span>
                    </span>
                    <span className="orbit-milestone-open" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                </li>
              );
            })}
          </CardWindow>

          <p className="orbit-window-bar">
            <span>共 {milestones.length} 项</span>
            <span>{windowHint}</span>
          </p>
        </section>
      </div>

      {selected
        ? createPortal(
            <div className="orbit-dialog-layer">
              <div className="orbit-dialog-veil" onClick={closeDialog} aria-hidden="true" />
              <div
                className="orbit-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="orbit-dialog-title"
                tabIndex={-1}
                ref={dialogRef}
              >
                <div className="orbit-dialog-head">
                  <p className="orbit-dialog-kicker">
                    学院节点 {pad(selectedIndex + 1)} / {pad(milestones.length)}
                  </p>
                  <button className="orbit-dialog-close" type="button" onClick={closeDialog} aria-label="关闭节点详情">
                    ✕
                  </button>
                </div>

                <div className="orbit-dialog-meta">
                  <span className={`orbit-badge ${badgeState(selected, today).className}`}>
                    {badgeState(selected, today).label}
                  </span>
                  <span className="orbit-dialog-date">{selected.dateLabel}</span>
                </div>

                <h3 className="orbit-dialog-title" id="orbit-dialog-title">
                  {selected.title}
                </h3>
                <p className="orbit-dialog-detail">{selected.detail}</p>

                {selected.materials.length > 0 ? (
                  <div className="orbit-dialog-block">
                    <p className="orbit-dialog-block-title">需要提交 / 携带</p>
                    <ul className="orbit-dialog-materials">
                      {selected.materials.map((material) => (
                        <li className="orbit-material" key={material}>
                          {material}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="orbit-dialog-foot">
                  <button
                    className="orbit-nav"
                    type="button"
                    onClick={() => selectByOffset(-1)}
                    disabled={selectedIndex <= 0}
                  >
                    ← 上一个
                  </button>
                  <span className="orbit-dialog-note">具体时间以学院通知为准</span>
                  <button
                    className="orbit-nav"
                    type="button"
                    onClick={() => selectByOffset(1)}
                    disabled={selectedIndex >= milestones.length - 1}
                  >
                    下一个 →
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
