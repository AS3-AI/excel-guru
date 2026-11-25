"use client";

import {
  plLessonsClasses,
} from "./player-styles";
import Link, { useLinkStatus } from "next/link";
import { Icon } from "@/components/icons";

export type LessonNavItem = { id: string; title: string; lastCompletedAt?: string; firstTryAccuracy?: number };
export function LessonList({ items, currentId }: { items: LessonNavItem[]; currentId: string }) {
  const done = items.filter((item) => item.lastCompletedAt).length;
  return <nav className={`pl-lessons ${plLessonsClasses}`} aria-label="Lessons"><h2>Lessons <span className="num">{done}/{items.length}</span></h2><ol>{items.map((item, i) => {
    const current = item.id === currentId;
    return <li key={item.id} className={`${current ? "is-current" : ""}${item.lastCompletedAt ? " is-done" : ""}`}>
      <Link href={`/lesson/${item.id}`} aria-current={current ? "page" : undefined}>
        <span className="pl-lesson-num num pt-[1px] text-faint text-[0.72rem] text-right">{i + 1}</span>
        <span className="pl-lesson-title [&_small]:block [&_small]:mt-[2px] [&_small]:text-muted [&_small]:text-[0.75rem]
          [&_b]:block [&_b]:mt-[3px] [&_b]:text-primary-strong [&_b]:[font:600_0.65rem_var(--mono)]
          [&_b]:tracking-[0.06em] [&_b]:uppercase">{item.title}{item.lastCompletedAt && <small>{new Date(item.lastCompletedAt).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" })} · {Math.round((item.firstTryAccuracy ?? 0) * 100)}% first try</small>}{current && <b>In progress</b>}</span>
        <LessonDot done={!!item.lastCompletedAt} />
      </Link>
    </li>;
  })}</ol></nav>;
}

/** Swaps the status dot for a spinner while this link's navigation is pending. */
function LessonDot({ done }: { done: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <span className="pl-lesson-dot is-loading grid place-items-center w-[16px] h-[16px] mt-[1px] rounded-[50%] [border:1.5px_solid_var(--faint)]" role="status" aria-label="Loading lesson" />;
  return <span className="pl-lesson-dot grid place-items-center w-[16px] h-[16px] mt-[1px] rounded-[50%] [border:1.5px_solid_var(--faint)]" aria-hidden="true">{done ? <Icon name="check" size={10} strokeWidth={3} /> : null}</span>;
}
