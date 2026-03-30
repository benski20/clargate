"use client";

import { useEffect, useRef, useState } from "react";

/** Interactive dot field — ported from generated-page (1).html */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const c2d: CanvasRenderingContext2D = ctx;

    const DOT_SPACING = 35;
    const MOUSE_RADIUS = 250;
    const BASE_RADIUS = 1;
    const GLOW_RADIUS = 2.5;

    let width = 0;
    let height = 0;
    let dots: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      col: number;
      row: number;
    }[] = [];
    const mouse = { x: -1000, y: -1000 };
    let time = 0;
    let raf = 0;

    function createDots() {
      dots = [];
      const cols = Math.ceil(width / DOT_SPACING) + 1;
      const rows = Math.ceil(height / DOT_SPACING) + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          dots.push({
            x: i * DOT_SPACING,
            y: j * DOT_SPACING,
            baseX: i * DOT_SPACING,
            baseY: j * DOT_SPACING,
            col: i,
            row: j,
          });
        }
      }
    }

    function initCanvas() {
      const node = canvasRef.current;
      if (!node) return;
      const parent = node.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      node.width = width;
      node.height = height;
      createDots();
    }

    function animate() {
      c2d.fillStyle = "#F4F1EA";
      c2d.fillRect(0, 0, width, height);

      time += 0.02;
      c2d.lineWidth = 0.5;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const waveX = Math.sin(time * 0.2 + dot.row * 0.05) * 1;
        const waveY = Math.cos(time * 0.2 + dot.col * 0.05) * 1;
        dot.x = dot.baseX + waveX;
        dot.y = dot.baseY + waveY;

        const dx = mouse.x - dot.x;
        const dy = mouse.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let radius = BASE_RADIUS;

        if (dist < MOUSE_RADIUS && dist > 0.001) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          dot.x -= (dx / dist) * force * 20;
          dot.y -= (dy / dist) * force * 20;
          radius = BASE_RADIUS + (GLOW_RADIUS - BASE_RADIUS) * force;
          c2d.fillStyle = `rgba(10, 10, 10, ${0.2 + force * 0.6})`;
          if (force > 0.7) {
            c2d.beginPath();
            c2d.moveTo(dot.x, dot.y);
            c2d.lineTo(mouse.x, mouse.y);
            c2d.strokeStyle = `rgba(10, 10, 10, ${force * 0.2})`;
            c2d.stroke();
          }
        } else {
          c2d.fillStyle = "#DCD8D0";
        }

        c2d.beginPath();
        c2d.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        c2d.fill();
      }

      raf = requestAnimationFrame(animate);
    }

    function onMouseMove(e: MouseEvent) {
      const node = canvasRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }
    function onResize() {
      initCanvas();
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", onResize);
    initCanvas();
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 z-0 h-full w-full bg-[#F4F1EA]"
        style={{
          backgroundImage: `radial-gradient(#DCD8D0 1px, transparent 1px)`,
          backgroundSize: "35px 35px",
        }}
        aria-hidden
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 h-full w-full opacity-70 transition-opacity duration-700 group-hover:opacity-100"
      aria-hidden
    />
  );
}
