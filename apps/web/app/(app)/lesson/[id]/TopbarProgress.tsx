"use client";

import { useEffect, useState } from "react";
import { countLessonProgress } from "@/lib/player-state";

export const LESSON_PROGRESS_EVENT = "excelguru:lesson-progress";

export type LessonProgressDetail = {
  completed: number;
  total: number;
};

export function TopbarProgress({ totalSteps }: { totalSteps: number }) {
  const [progress, setProgress] = useState<LessonProgressDetail>({
    completed: 0,
    total: totalSteps,
  });

  useEffect(() => {
    setProgress({ completed: 0, total: totalSteps });
  }, [totalSteps]);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<LessonProgressDetail>).detail;
      if (detail) setProgress(detail);
    };
    window.addEventListener(LESSON_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(LESSON_PROGRESS_EVENT, onProgress);
  }, []);

  const { completed, total, pct } = countLessonProgress(
    progress.total,
    0,
    progress.completed,
    false,
  );

  return (
    <div
      className="pl-top-progress flex items-center gap-s2"
      role="progressbar"
      aria-label="Lesson progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="w-[110px] sm:w-[150px] h-[10px] [border:1.5px_solid_var(--ink)] rounded-full bg-surface-sunk overflow-hidden">
        <div
          className="h-full bg-primary [transition:width_var(--d3)_var(--ease)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="num [font:600_var(--fs-xs)_var(--mono)] text-ink whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}
