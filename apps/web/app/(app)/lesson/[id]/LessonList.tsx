"use client";

import { plLessonsClasses } from "./player-styles";
import Link, { useLinkStatus } from "next/link";
import { Icon } from "@/components/icons";

export type LessonNavItem = {
  id: string;
  title: string;
  /** Topic number in the course index. */
  n: number;
  /** Set on the first topic of each level: the level's heading. */
  level?: string;
  /** In the index but not written yet: shown, not linked. */
  comingSoon?: boolean;
  lastCompletedAt?: string;
  firstTryAccuracy?: number;
};
export function LessonList({
  items,
  currentId,
  collapsed = false,
  onCollapse,
}: {
  items: LessonNavItem[];
  currentId: string;
  collapsed?: boolean;
  onCollapse?: () => void;
}) {
  const done = items.filter((item) => item.lastCompletedAt).length;
  const available = items.filter((item) => !item.comingSoon).length;
  if (collapsed) {
    return (
      <nav className="flex-1 min-h-0 flex flex-col" aria-label="Lessons">
        <div
          className="py-s2 text-center text-muted [font:500_var(--fs-xs)/1_var(--mono)]"
          title={`${done} of ${available} lessons completed`}
        >
          <span className="num">
            {done}/{available}
          </span>
        </div>
        <ol className="flex-1 min-h-0 overflow-y-auto [overscroll-behavior:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden list-none m-0 p-[0_6px_var(--s3)] flex flex-col items-center gap-[4px]">
          {items.map((item) => {
            const current = item.id === currentId;
            if (item.comingSoon)
              return (
                <li key={item.id} className="w-full flex justify-center">
                  <span
                    className="num grid place-items-center w-[34px] h-[34px] text-[0.78rem] text-faint"
                    title={`${item.n}. ${item.title} (coming soon)`}
                  >
                    {item.n}
                  </span>
                </li>
              );
            return (
              <li key={item.id} className="w-full flex justify-center">
                <Link
                  href={`/lesson/${item.id}`}
                  aria-current={current ? "page" : undefined}
                  aria-label={`${item.n}. ${item.title}${item.lastCompletedAt ? " (completed)" : ""}`}
                  title={`${item.n}. ${item.title}`}
                  className={`num grid place-items-center w-[34px] h-[34px] rounded-ledger-sm text-[0.78rem] font-medium no-underline
                    [transition:background-color_var(--d1)_var(--ease),_border-color_var(--d1)_var(--ease)]
                    ${
                      current
                        ? "bg-mint text-ink font-semibold [border:1.5px_solid_var(--ink)] [box-shadow:2px_2px_0_var(--ink)]"
                        : item.lastCompletedAt
                          ? "bg-primary text-[#fff] [border:1.5px_solid_var(--primary)] hover:opacity-90"
                          : "text-text hover:bg-surface-sunk [border:1px_solid_transparent]"
                    }`}
                >
                  {item.n}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }
  return (
    <nav className={`pl-lessons ${plLessonsClasses}`} aria-label="Lessons">
      <h2>
        <span>Lessons</span>
        <span className="flex items-center gap-s2">
          <span className="num">
            {done}/{available}
          </span>
          {onCollapse && (
            <button
              type="button"
              className="grid place-items-center w-[28px] h-[28px] -mr-[6px] [border:0] rounded-ledger-sm [background:none] text-ink cursor-pointer hover:bg-surface-sunk"
              aria-label="Collapse lessons sidebar"
              aria-expanded={true}
              title="Collapse lessons"
              onClick={onCollapse}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
          )}
        </span>
      </h2>
      <ol>
        {items.map((item) => {
          const current = item.id === currentId;
          const heading = item.level && (
            <li
              key={`level-${item.n}`}
              className="pt-s4 pb-s1 px-[8px] text-muted [font:500_var(--fs-xs)/1.3_var(--mono)] tracking-[0.06em] uppercase"
              aria-hidden="true"
            >
              {item.level}
            </li>
          );
          if (item.comingSoon)
            return [
              heading,
              <li key={item.id}>
                <div className="grid grid-cols-[24px_minmax(0,_1fr)_16px] gap-[8px] items-start p-[9px_8px] text-faint text-[0.9rem] leading-[1.35]">
                  <span className="num pt-[1px] text-[0.72rem] text-right">{item.n}</span>
                  <span>
                    {item.title}
                    <small className="block mt-[2px] text-[0.72rem]">Coming soon</small>
                  </span>
                </div>
              </li>,
            ];
          return [
            heading,
            <li
              key={item.id}
              className={`${current ? "is-current" : ""}${item.lastCompletedAt ? " is-done" : ""}`}
            >
              <Link href={`/lesson/${item.id}`} aria-current={current ? "page" : undefined}>
                <span className="pl-lesson-num num pt-[1px] text-faint text-[0.72rem] text-right">
                  {item.n}
                </span>
                <span
                  className="pl-lesson-title [&_small]:block [&_small]:mt-[2px] [&_small]:text-muted [&_small]:text-[0.75rem]
          [&_b]:block [&_b]:mt-[3px] [&_b]:text-primary-strong [&_b]:[font:600_0.65rem_var(--mono)]
          [&_b]:tracking-[0.06em] [&_b]:uppercase"
                >
                  {item.title}
                  {item.lastCompletedAt && (
                    <small>
                      {new Date(item.lastCompletedAt).toLocaleDateString("en-US", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      · {Math.round((item.firstTryAccuracy ?? 0) * 100)}% first try
                    </small>
                  )}
                  {current && <b>In progress</b>}
                </span>
                <LessonDot done={!!item.lastCompletedAt} />
              </Link>
            </li>,
          ];
        })}
      </ol>
    </nav>
  );
}

/** Swaps the status dot for a spinner while this link's navigation is pending. */
function LessonDot({ done }: { done: boolean }) {
  const { pending } = useLinkStatus();
  if (pending)
    return (
      <span
        className="pl-lesson-dot is-loading grid place-items-center w-[16px] h-[16px] mt-[1px] rounded-[50%] [border:1.5px_solid_var(--border-strong)]"
        role="status"
        aria-label="Loading lesson"
      />
    );
  return (
    <span
      className="pl-lesson-dot grid place-items-center w-[16px] h-[16px] mt-[1px] rounded-[50%] [border:1.5px_solid_var(--border-strong)]"
      aria-hidden="true"
    >
      {done ? <Icon name="check" size={10} strokeWidth={3} /> : null}
    </span>
  );
}
