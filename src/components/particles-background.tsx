"use client";

import { useEffect, useRef } from "react";

/**
 * 粒子装饰组件 - 在背景层绘制动态的科研相关图形
 *
 * 绘制内容：
 * - 浮动的圆形节点（代表原子/数据点）
 * - 连接线（代表分子键/网络连接）
 * - 缓慢漂移的几何轨迹
 *
 * 性能优化：
 * - 使用 requestAnimationFrame
 * - 低透明度，不干扰阅读
 * - 窄屏/减弱动画模式下自动停止
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  type: "node" | "orbit";
}

interface Connection {
  from: number;
  to: number;
  opacity: number;
}

export function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 检查是否应该禁用动画
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(hover: none)").matches || window.innerWidth < 900;

    if (prefersReducedMotion || isMobile) {
      // 静态绘制一次就停止
      drawStatic(ctx, canvas);
      return;
    }

    // 设置画布尺寸
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // 初始化粒子
    const initParticles = () => {
      const rect = canvas.getBoundingClientRect();
      const count = Math.min(25, Math.floor(rect.width / 60)); // 根据屏幕宽度调整数量

      particlesRef.current = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 1.5,
        opacity: Math.random() * 0.4 + 0.1,
        type: i < count * 0.7 ? "node" : "orbit",
      }));
    };

    initParticles();

    // 鼠标移动监听（用于交互效果）
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    canvas.addEventListener("mousemove", handleMouseMove);

    // 动画循环
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // 更新和绘制粒子
      particles.forEach((p) => {
        // 更新位置
        p.x += p.vx;
        p.y += p.vy;

        // 边界反弹
        if (p.x < 0 || p.x > rect.width) p.vx *= -1;
        if (p.y < 0 || p.y > rect.height) p.vy *= -1;

        // 鼠标排斥效果
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120;
          p.vx -= (dx / dist) * force * 0.02;
          p.vy -= (dy / dist) * force * 0.02;
        }

        // 速度限制
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.8) {
          p.vx = (p.vx / speed) * 0.8;
          p.vy = (p.vy / speed) * 0.8;
        }

        // 绘制粒子
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(11, 13, 16, ${p.opacity})`;
        ctx.fill();

        // 轨道类型粒子绘制外圈
        if (p.type === "orbit") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(11, 13, 16, ${p.opacity * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });

      // 绘制连线（距离近的粒子之间）
      connectionsRef.current = [];
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            const opacity = (1 - dist / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(11, 13, 16, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            connectionsRef.current.push({ from: i, to: j, opacity });
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // 清理
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="particles-canvas"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}

/**
 * 静态模式：只绘制一次固定图案（用于减弱动画/窄屏）
 */
function drawStatic(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  // 绘制静态点阵
  const spacing = 50;
  for (let x = spacing; x < rect.width; x += spacing) {
    for (let y = spacing; y < rect.height; y += spacing) {
      if (Math.random() > 0.6) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(11, 13, 16, 0.08)";
        ctx.fill();
      }
    }
  }

  // 绘制几条静态线条
  ctx.strokeStyle = "rgba(11, 13, 16, 0.04)";
  ctx.lineWidth = 1;

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * rect.width, Math.random() * rect.height);
    ctx.lineTo(Math.random() * rect.width, Math.random() * rect.height);
    ctx.stroke();
  }
}
