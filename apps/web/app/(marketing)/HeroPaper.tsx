"use client";

import { useEffect, useRef } from "react";

export function HeroPaper() {
  const paperRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paper = paperRef.current;
    const cell = cellRef.current;
    const hero = paper?.parentElement;
    if (!paper || !cell || !hero) return;

    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = paper.getBoundingClientRect();
      const column = Math.floor((event.clientX - bounds.left) / 96);
      const row = Math.floor((event.clientY - bounds.top) / 32);
      cell.style.transform = `translate(${column * 96}px, ${row * 32}px)`;
      cell.style.opacity = "1";
    };
    const leave = () => { cell.style.opacity = "0"; };
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", leave);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <div ref={paperRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0 [background-image:linear-gradient(rgb(20_32_26_/_0.09)_1px,_transparent_1px),_linear-gradient(90deg,_rgb(20_32_26_/_0.09)_1px,_transparent_1px)] [background-size:96px_32px] [background-position:-1px_-1px] [mask-image:radial-gradient(ellipse_75%_85%_at_75%_40%,_#000_0%,_transparent_75%)]" />
    <div ref={cellRef} className="absolute left-[-1px] top-[-1px] h-[32px] w-[96px] border border-[rgb(16_124_65_/_0.18)] bg-white/25 opacity-0 transition-opacity duration-300 ease-out motion-reduce:transition-none" />
  </div>;
}
