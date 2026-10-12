"use client";

import { useParallax } from "@/hooks/use-parallax";
import { ReactNode } from "react";

/**
 * 视差包装组件
 *
 * 为子元素添加滚动视差效果。
 *
 * @param children - 子元素
 * @param speed - 视差速度（0-1）
 * @param className - 额外的 CSS 类名
 * @param direction - 视差方向
 */

interface ParallaxWrapperProps {
  children: ReactNode;
  speed?: number;
  direction?: "up" | "down";
  className?: string;
}

export function ParallaxWrapper({
  children,
  speed = 0.3,
  direction = "up",
  className = "",
}: ParallaxWrapperProps) {
  const offset = useParallax(speed, direction);

  return (
    <div
      className={`parallax-${speed > 0.5 ? "medium" : "slow"} ${className}`}
      style={{ transform: `translateY(${offset}px)` }}
    >
      {children}
    </div>
  );
}
