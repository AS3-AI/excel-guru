"use client";

import { useId, type KeyboardEvent, type Ref } from "react";

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
  /** Enter commits and steps down (`step`); ✓ commits in place. */
  onCommit: (step: boolean) => void;
  onCancel: () => void;
  onFx: () => void;
};

/** Name box, ✕ ✓ fx buttons, the formula input and, under it, any parse error. */
export function FormulaBar({
  address, value, editing, error, inputRef, onStartEdit, onChange, onCommit, onCancel, onFx,
}: Props) {
  const errorId = useId();
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
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
            disabled={!editing} onMouseDown={keepFocus} onClick={() => onCommit(false)}
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
        />
      </div>
      <p id={errorId} className="eg-fbar-error" aria-live="polite">{error ?? ""}</p>
    </div>
  );
}
