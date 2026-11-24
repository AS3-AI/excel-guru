"use client";

import { useEffect } from "react";

/**
 * Scroll motion for server-rendered pages, without making them client components.
 * - [data-reveal]: gets data-shown once it enters the viewport (CSS does the animation).
 * - [data-count]: counts up from 0 to its rendered number when shown.
 * Content is fully visible without JS; reduced-motion users get the final state immediately.
 */
export function Reveal() {
  useEffect(() => {
    const html = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    html.dataset.motion = still ? "off" : "on";
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (still) { items.forEach((el) => { el.dataset.shown = ""; }); return; }

    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || target <= 0) return;
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / 900);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.dataset.shown = "";
        el.querySelectorAll<HTMLElement>("[data-count]").forEach(countUp);
        io.unobserve(el);
      }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
