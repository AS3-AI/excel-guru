"use client";

import {
  useEffect, useId, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject,
} from "react";

/** A reference in the draft being edited and its colour index (see refs.ts and the .eg-ref-N classes). */
export type ColouredRef = { start: number; end: number; colour: number };

/** The draft with each reference wrapped in its colour. */
export function RefText({ text, refs }: { text: string; refs: ColouredRef[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  refs.forEach((r, i) => {
    if (r.start > at) parts.push(text.slice(at, r.start));
    parts.push(<span key={i} className={`eg-reftext eg-ref-${r.colour}`}>{text.slice(r.start, r.end)}</span>);
    at = r.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * An <input> can't colour part of its text, so an editor showing a formula draws its own text
 * transparent and this layer shows it, coloured, exactly on top (same font and padding; it never
 * takes pointer events). It follows the input's horizontal scroll so long formulas stay aligned.
 */
export function RefMirror({ text, refs, inputRef, className }: {
  text: string; refs: ColouredRef[]; inputRef: RefObject<HTMLInputElement | null>; className: string;
}) {
  const inner = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = inputRef.current, span = inner.current;
    if (!el || !span) return;
    const sync = () => { span.style.transform = `translateX(${-el.scrollLeft}px)`; };
    sync();
    // The caret can scroll the input without a render (arrow keys, Home/End, selecting).
    const events = ["scroll", "keyup", "select", "input", "mouseup"] as const;
    events.forEach((t) => el.addEventListener(t, sync));
    return () => events.forEach((t) => el.removeEventListener(t, sync));
  });
  return (
    <div className={`eg-mirror ${className}`} aria-hidden="true">
      <span ref={inner} className="eg-mirror-text"><RefText text={text} refs={refs} /></span>
    </div>
  );
}

type Props = {
  /** Active cell address, shown in the name box. */
  address: string;
  /** The draft while editing, otherwise the active cell's formula or literal. */
  value: string;
  editing: boolean;
  /** Tokenize/parse message from the last failed commit. */
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  /** While editing a formula, its references (coloured in the input's text); otherwise null. */
  refs: ColouredRef[] | null;
  /** Focusing the bar starts editing the active cell. */
  onStartEdit: () => void;
  onChange: (value: string) => void;
  /** The grid's editor keys, shared with the in-cell editor: Enter/Tab commit and step, Escape cancels. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Focus leaving the editor commits (or drops an unparseable draft), so no edit is left open. */
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  /** A click placed the caret in the input: arrows move the caret from then on (Excel's Edit mode). */
  onCaretPlace: () => void;
  /** ✓: commit in place. */
  onConfirm: () => void;
  onCancel: () => void;
  onFx: () => void;
};

/** Name box, ✕ ✓ fx buttons, the formula input and, under it, any parse error. */
export function FormulaBar({
  address, value, editing, error, inputRef, refs, onStartEdit, onChange, onKeyDown, onBlur, onCaretPlace, onConfirm, onCancel, onFx,
}: Props) {
  const errorId = useId();
  // Keep focus in the editor when a button is pressed, so ✓ commits what was typed.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div className="eg-fbar-wrap">
      <div className="eg-fbar">
        <div className="eg-namebox" aria-label="Name box" role="status">{address}</div>
        <div className="eg-fbar-btns">
          <button
            type="button" className="eg-fbtn" aria-label="Cancel" title="Cancel (Esc)"
            disabled={!editing} onMouseDown={keepFocus} onClick={onCancel}
          >✕</button>
          <button
            type="button" className="eg-fbtn" aria-label="Enter" title="Enter"
            disabled={!editing} onMouseDown={keepFocus} onClick={onConfirm}
          >✓</button>
          <button
            type="button" className="eg-fbtn eg-fx" aria-label="Insert function" title="Start a formula"
            onMouseDown={keepFocus} onClick={onFx}
          ><i>fx</i></button>
        </div>
        <div className="eg-finput-wrap">
          <input
            ref={inputRef}
            className={`eg-finput${refs ? " has-mirror" : ""}`}
            aria-label="Formula bar"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={value}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            onFocus={() => { if (!editing) onStartEdit(); }}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onMouseUp={onCaretPlace}
          />
          {refs && <RefMirror text={value} refs={refs} inputRef={inputRef} className="eg-finput-mirror" />}
        </div>
      </div>
      <p id={errorId} className="eg-fbar-error" aria-live="polite">{error ?? ""}</p>
    </div>
  );
}
