"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export function isValidYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function VideoModal({ videoId }: { videoId: string | null }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const validVideoId = isValidYouTubeVideoId(videoId) ? videoId : null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    return () => triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, iframe, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hasAttribute("disabled"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };

  if (!validVideoId) return null;
  return <>
    <button ref={triggerRef} className="btn btn-quiet" type="button" onClick={() => setOpen(true)}><Icon name="play" size={16} />Watch lesson video</button>
    {open && <div className="video-modal-backdrop fixed z-[var(--z-modal)] inset-0 grid place-items-center p-s4 [background:rgb(20_32_26_/_0.72)]
          [animation:fade-in_var(--d2)_var(--ease)]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="video-modal w-[min(900px,_100%)] p-s4 [border:var(--line)] rounded-ledger-lg bg-surface text-text
          [box-shadow:var(--shadow-pop)] [animation:profile-modal-in_var(--d3)_var(--ease)]
          [&_iframe]:block [&_iframe]:w-full [&_iframe]:[aspect-ratio:16_/_9] [&_iframe]:[border:0]
          [&_iframe]:rounded-ledger-sm [&_iframe]:bg-ink" role="dialog" aria-modal="true" aria-labelledby="lesson-video-title" onKeyDown={onDialogKeyDown}>
        <header className="video-modal-header flex items-center justify-between gap-s3 mb-s3
          [&_h2]:m-0 [&_h2]:text-ink [&_h2]:text-ledger-md
          [&_button]:grid [&_button]:place-items-center [&_button]:min-w-[44px] [&_button]:min-h-[44px]
          [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-ledger [&_button]:bg-surface [&_button]:text-ink
          [&_button]:cursor-pointer
          [&_button:hover]:bg-surface-sunk"><h2 id="lesson-video-title">Lesson video</h2><span tabIndex={0} onFocus={() => iframeRef.current?.focus()} /><button ref={closeRef} type="button" aria-label="Close video" onClick={() => setOpen(false)}><Icon name="x" size={18} /></button></header>
        <iframe ref={iframeRef} title="Lesson video" src={`https://www.youtube-nocookie.com/embed/${validVideoId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        <span tabIndex={0} onFocus={() => closeRef.current?.focus()} />
      </div>
    </div>}
  </>;
}
