"use client";

import { useEffect, useRef } from "react";

/**
 * 鼠标跟随光效组件
 *
 * 在 Hero 区域显示一个跟随鼠标移动的柔和光晕，
 * 增强交互感和视觉趣味性。
 *
 * 特性：
 * - 平滑的缓动跟随（不是 1:1 跟随，有延迟）
 * - 渐变透明度
 * - 自动在容器边界内限制
 * - 窄屏/减弱动画模式下隐藏
 */

export function MouseGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;

    // 检查是否应该禁用
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(hover: none)").matches || window.innerWidth < 900;

    if (prefersReducedMotion || isMobile) {
      glow.style.display = "none";
      return;
    }

    // 获取父容器
    const container = glow.parentElement;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      targetRef.current = { x: -1000, y: -1000 }; // 移出可视区域
    };

    // 缓动动画循环
    const animate = () => {
      // 线性插值（lerp）实现平滑跟随
      const ease = 0.08;
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * ease;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * ease;

      if (glow) {
        glow.style.transform = `translate(${currentRef.current.x - 300}px, ${currentRef.current.y - 300}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    animate();

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <div className="hero-glow" ref={glowRef} aria-hidden="true" />;
}
