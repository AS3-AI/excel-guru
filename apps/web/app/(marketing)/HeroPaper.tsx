"use client";

import { useEffect, useRef } from "react";

const TRAIL_SIZE = 18;

export function HeroPaper() {
  const paperRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paper = paperRef.current;
    const glow = glowRef.current;
    const hero = paper?.parentElement;
    const cells = Array.from(trailRef.current?.children ?? []) as HTMLDivElement[];
    if (!paper || !glow || !hero || !cells.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousCell = "";
    let nextCell = 0;

    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reducedMotion.matches) return;
      const bounds = paper.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      glow.style.transform = `translate(${x}px, ${y}px)`;
      glow.style.opacity = "1";

      const column = Math.floor(x / 96);
      const row = Math.floor(y / 32);
      const cellKey = `${column}:${row}`;
      if (cellKey === previousCell) return;
      previousCell = cellKey;

      const cell = cells[nextCell % cells.length]!;
      nextCell++;
      cell.getAnimations().forEach((animation) => animation.cancel());
      cell.style.left = `${column * 96 - 1}px`;
      cell.style.top = `${row * 32 - 1}px`;
      cell.animate([{ opacity: 0 }, { opacity: 0.45, offset: 0.25 }, { opacity: 0 }], {
        duration: 1400,
        easing: "ease-out",
      });
    };
    const leave = () => {
      glow.style.opacity = "0";
      previousCell = "";
    };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", leave);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      cells.forEach((cell) => cell.getAnimations().forEach((animation) => animation.cancel()));
    };
  }, []);

  return (
    <div
      ref={paperRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 [background-image:linear-gradient(rgb(20_32_26_/_0.09)_1px,_transparent_1px),_linear-gradient(90deg,_rgb(20_32_26_/_0.09)_1px,_transparent_1px)] [background-size:96px_32px] [background-position:-1px_-1px] [mask-image:radial-gradient(ellipse_75%_85%_at_75%_40%,_#000_0%,_transparent_75%)]" />
      <div
        ref={glowRef}
        className="absolute left-[-150px] top-[-150px] h-[300px] w-[300px] rounded-full opacity-0 [background:radial-gradient(circle,_rgb(255_255_255_/_0.16),_transparent_70%)] transition-opacity duration-500"
      />
      <div ref={trailRef}>
        {Array.from({ length: TRAIL_SIZE }, (_, index) => (
          <div
            key={index}
            className="absolute h-[32px] w-[96px] rounded-[2px] border border-white/30 bg-white/30 opacity-0 [box-shadow:0_0_14px_2px_rgb(255_255_255_/_0.25)]"
          />
        ))}
      </div>
    </div>
  );
}
