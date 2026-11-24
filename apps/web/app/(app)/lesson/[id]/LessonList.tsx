"use client";

import Link, { useLinkStatus } from "next/link";
import { Icon } from "@/components/icons";

export type LessonNavItem = { id: string; title: string; lastCompletedAt?: string; firstTryAccuracy?: number };
export function LessonList({ items, currentId }: { items: LessonNavItem[]; currentId: string }) {
  const done = items.filter((item) => item.lastCompletedAt).length;
  return <nav className="pl-lessons" aria-label="Lessons"><h2>Lessons <span className="num">{done}/{items.length}</span></h2><ol>{items.map((item, i) => {
    const current = item.id === currentId;
    return <li key={item.id} className={`${current ? "is-current" : ""}${item.lastCompletedAt ? " is-done" : ""}`}>
      <Link href={`/lesson/${item.id}`} aria-current={current ? "page" : undefined}>
        <span className="pl-lesson-num num">{i + 1}</span>
        <span className="pl-lesson-title">{item.title}{item.lastCompletedAt && <small>{new Date(item.lastCompletedAt).toLocaleDateString()} · {Math.round((item.firstTryAccuracy ?? 0) * 100)}% first try</small>}{current && <b>In progress</b>}</span>
        <LessonDot done={!!item.lastCompletedAt} />
      </Link>
    </li>;
  })}</ol></nav>;
}

/** Swaps the status dot for a spinner while this link's navigation is pending. */
function LessonDot({ done }: { done: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <span className="pl-lesson-dot is-loading" role="status" aria-label="Loading lesson" />;
  return <span className="pl-lesson-dot" aria-hidden="true">{done ? <Icon name="check" size={10} strokeWidth={3} /> : null}</span>;
}
