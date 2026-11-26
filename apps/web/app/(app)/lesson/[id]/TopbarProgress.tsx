"use client";

import { useEffect, useState } from "react";

export const LESSON_PROGRESS_EVENT = "excelguru:lesson-progress";

export type LessonProgressDetail = {
  correct: number;
  total: number;
};

export function TopbarProgress({ requiredCorrect }: { requiredCorrect: number }) {
  const [progress, setProgress] = useState<LessonProgressDetail>({
    correct: 0,
    total: requiredCorrect,
  });

  useEffect(() => {
    setProgress({ correct: 0, total: requiredCorrect });
  }, [requiredCorrect]);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<LessonProgressDetail>).detail;
      if (detail) setProgress(detail);
    };
    window.addEventListener(LESSON_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(LESSON_PROGRESS_EVENT, onProgress);
  }, []);

  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.correct / progress.total) * 100)) : 0;

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
        {progress.correct}/{progress.total}
      </span>
    </div>
  );
}
