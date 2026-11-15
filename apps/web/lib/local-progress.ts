"use client";

import type { ProgressAttempt } from "./progress";

export const LOCAL_PROGRESS_KEY = "eg_progress";
export type LocalLessonProgress = { lessonId: string; attempts: ProgressAttempt[] };

export function readLocalProgress(): LocalLessonProgress[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalLessonProgress => item && typeof item.lessonId === "string" && Array.isArray(item.attempts));
  } catch { return []; }
}

export function writeLocalProgress(lessonId: string, attempts: ProgressAttempt[]): void {
  try {
    const current = readLocalProgress().filter((item) => item.lessonId !== lessonId);
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify([...current, { lessonId, attempts }]));
  } catch { /* Storage may be disabled or full. */ }
}

export function clearLocalProgress(): void {
  try { localStorage.removeItem(LOCAL_PROGRESS_KEY); } catch { /* Storage may be disabled. */ }
}

let mergeInFlight: Promise<boolean> | null = null;

export function mergeLocalProgress(): Promise<boolean> {
  if (mergeInFlight) return mergeInFlight;
  const lessons = readLocalProgress();
  if (!lessons.length) return Promise.resolve(true);
  const request = (async () => {
    try {
      const response = await fetch("/api/progress/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessons }) });
      if (!response.ok) return false;
      clearLocalProgress();
      return true;
    } catch { return false; }
  })();
  mergeInFlight = request;
  void request.finally(() => { if (mergeInFlight === request) mergeInFlight = null; });
  return request;
}
