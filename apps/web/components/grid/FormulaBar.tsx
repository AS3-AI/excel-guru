"use client";

import { useId, type FocusEvent, type KeyboardEvent, type Ref } from "react";

type Props = {
  /** Active cell address, shown in the name box. */
  address: string;
  /** The draft while editing, otherwise the active cell's formula or literal. */
  value: string;
  editing: boolean;
  /** Tokenize/parse message from the last failed commit. */
  error: string | null;
  inputRef: Ref<HTMLInputElement>;
  /** Focusing the bar starts editing the active cell. */
  onStartEdit: () => void;
  onChange: (value: string) => void;
  /** The grid's editor keys, shared with the in-cell editor: Enter/Tab commit and step, Escape cancels. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Focus leaving the editor commits (or drops an unparseable draft), so no edit is left open. */
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  /** ✓: commit in place. */
  onConfirm: () => void;
  onCancel: () => void;
  onFx: () => void;
};

/** Name box, ✕ ✓ fx buttons, the formula input and, under it, any parse error. */
export function FormulaBar({
  address, value, editing, error, inputRef, onStartEdit, onChange, onKeyDown, onBlur, onConfirm, onCancel, onFx,
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
        <input
          ref={inputRef}
          className="eg-finput"
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
        />
      </div>
      <p id={errorId} className="eg-fbar-error" aria-live="polite">{error ?? ""}</p>
    </div>
  );
}
