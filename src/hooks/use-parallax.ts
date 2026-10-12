"use client";

import { useEffect, useState } from "react";

/**
 * 滚动视差 Hook
 *
 * 返回当前滚动位置相关的偏移值，用于实现视差效果。
 *
 * @param speed - 视差速度（0-1），0 = 不动，1 = 跟随滚动
 * @param direction - 方向，'up' 或 'down'
 *
 * 使用方式：
 * const offset = useParallax(0.3); // 30% 速度的视差
 * <div style={{ transform: `translateY(${offset}px)` }} />
 */

export function useParallax(speed: number = 0.3, direction: "up" | "down" = "up") {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    // 检查是否应该禁用
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const multiplier = direction === "up" ? -1 : 1;
          setOffset(scrollY * speed * multiplier);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // 初始化

    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed, direction]);

  return offset;
}
