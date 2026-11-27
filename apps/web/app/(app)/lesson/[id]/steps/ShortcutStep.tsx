"use client";

import { useMemo, useRef, useState } from "react";
import type { ShortcutStep as ShortcutStepType, Os } from "@excel-guru/grader";
import { normaliseKeys } from "@excel-guru/grader";
import type { KeyEventLike } from "@excel-guru/grader";
import { RichText } from "../../../../../components/RichText";
import { Grid } from "../../../../../components/grid/Grid";
import { shortcutView } from "../../../../../lib/shortcut-view";

type Mode = "chord" | "sequence";
type PressEvent = KeyEventLike & { repeat?: boolean; isComposing?: boolean };
export type PressResult = {
  status: "ignored" | "progress" | "correct" | "wrong";
  index: number;
  input: string;
};
export function shortcutSkipOutcome(
  steps: readonly { type: string }[],
  index: number,
  correct: number,
  requiredCorrect: number,
): "advance" | "keyboard-required" {
  const remaining = steps.slice(index);
  const reachable =
    correct +
    remaining.filter((candidate) => candidate.type !== "shortcut" && candidate.type !== "info")
      .length;
  return remaining.every((candidate) => candidate.type === "shortcut") &&
    reachable < requiredCorrect
    ? "keyboard-required"
    : "advance";
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "OS"]);
const RESERVED = new Set([
  "Ctrl+W",
  "Ctrl+T",
  "Ctrl+N",
  "Ctrl+Q",
  "Ctrl+Tab",
  "Cmd+W",
  "Cmd+T",
  "Cmd+N",
  "Cmd+Q",
  "Cmd+Tab",
]);
const isReserved = (combo: string) => RESERVED.has(combo);
const isModifierCombo = (combo: string) =>
  combo !== "" && combo.split("+").every((part) => ["Ctrl", "Alt", "Shift", "Cmd"].includes(part));

/** Pure keyboard transition shared by the player and unit tests. */
export function handleShortcutPress(
  event: PressEvent,
  mode: Mode,
  expected: readonly string[],
  index: number,
): PressResult {
  const unchanged = (status: PressResult["status"]): PressResult => ({ status, index, input: "" });
  if (event.repeat || event.isComposing || event.key === "Process" || event.key === "Unidentified")
    return unchanged("ignored");
  const pressed = normaliseKeys(event);
  if (mode === "chord" && (MODIFIER_KEYS.has(event.key) || isModifierCombo(pressed)))
    return unchanged("ignored");
  if ((event.key === "Escape" || event.key === "Tab") && !expected.includes(pressed))
    return unchanged("ignored");
  if (mode === "sequence" && MODIFIER_KEYS.has(event.key) && expected[index] !== pressed)
    return unchanged("ignored");
  if (mode === "chord")
    return { status: pressed === expected[0] ? "correct" : "wrong", index: 0, input: pressed };
  if (index >= expected.length) index = 0;
  if (pressed !== expected[index])
    return { status: "wrong", index: 0, input: [...expected.slice(0, index), pressed].join(" ⟶ ") };
  const nextIndex = index + 1;
  return {
    status: nextIndex === expected.length ? "correct" : "progress",
    index: nextIndex,
    input: expected.slice(0, nextIndex).join(" ⟶ "),
  };
}

function pretty(key: string, os: Os): string {
  return key
    .replace(/Arrow(Up|Down|Left|Right)/g, "$1")
    .replace("Cmd", os === "mac" ? "⌘" : "Win")
    .replace("Ctrl", os === "mac" ? "⌃" : "Ctrl")
    .replace("Alt", os === "mac" ? "⌥" : "Alt")
    .replace("Shift", os === "mac" ? "⇧" : "Shift");
}
function keyHint(step: ShortcutStepType, os: Os): string {
  if (step.mode === "sequence") {
    const keys = step.keys[os];
    return keys === null ? "" : `Press ${keys.map((key) => pretty(key, os)).join(" → ")}`;
  }
  const keys = step.keys[os];
  if (keys === null) return "";
  const parts = keys.split("+");
  const key = parts.pop() ?? "";
  if (os === "mac") parts.sort((a, b) => (a === "Cmd" ? -1 : b === "Cmd" ? 1 : 0));
  return parts.length
    ? `Hold ${parts.map((part) => pretty(part, os)).join(" + ")}, press ${pretty(key, os)}`
    : `Press ${pretty(key, os)}`;
}

export function ShortcutStep({
  step,
  os,
  touch,
  showPostcondition,
  onAttempt,
  onSkip,
  onSkipSection,
  onPracticeReady,
}: {
  step: ShortcutStepType;
  os: Os;
  touch: boolean;
  showPostcondition?: boolean;
  onAttempt: (input: string, correct: boolean) => void;
  onSkip: () => void;
  onSkipSection: () => void;
  onPracticeReady?: (node: HTMLElement | null) => void;
}) {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const practiceRef = useRef<HTMLElement>(null);
  const keys = step.keys[os];
  const expected = useMemo(
    () => (keys === null ? [] : Array.isArray(keys) ? keys : [keys]),
    [keys],
  );
  const isMissingMac = os === "mac" && keys === null;
  const hint = keyHint(step, os);
  const view = shortcutView(step, Boolean(showPostcondition));

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (keys === null || event.defaultPrevented) return;
    const result = handleShortcutPress(event, step.mode, expected, sequenceIndex);
    if (result.status === "ignored") return;
    const pressed = normaliseKeys(event);
    const usedCombo =
      step.mode === "chord" ? result.input === expected[0] : pressed === expected[sequenceIndex];
    if (usedCombo && !isReserved(pressed)) {
      event.preventDefault();
      if (pressed.endsWith("Escape")) event.stopPropagation();
    }
    if (step.mode === "sequence") setSequenceIndex(result.index);
    if (step.mode === "sequence" && result.status === "progress") return;
    onAttempt(result.input, result.status === "correct");
    if (step.mode === "sequence" && result.status === "wrong") setSequenceIndex(0);
  };

  return (
    <section
      className="shortcut-practice group min-w-0 text-text outline-none"
      tabIndex={0}
      aria-label="Shortcut practice area"
      onKeyDown={onKeyDown}
      ref={(node) => {
        practiceRef.current = node;
        onPracticeReady?.(node);
      }}
    >
      {touch && (
        <div
          className="mb-[14px] flex flex-wrap items-center gap-[6px] rounded-[8px] bg-surface-warm p-[12px] text-ink"
          role="status"
        >
          Mobile device detected —{" "}
          <button
            className="cursor-pointer border-0 bg-transparent p-0 [font:inherit] [font-weight:700] text-primary-strong underline"
            type="button"
            onClick={onSkipSection}
          >
            Skip section
          </button>
        </div>
      )}
      <p className="m-0 mb-s4 max-w-[66ch] text-ink [font:400_1.06rem/1.65_var(--font)]">
        {step.prompt.split(/\n\n+/).map((para, i) => (
          <span key={i} className="block [&+&]:mt-s3">
            <RichText text={para} />
          </span>
        ))}
      </p>
      {isMissingMac ? (
        <div
          className="mb-[14px] flex flex-wrap items-center gap-[6px] rounded-[8px] bg-surface-warm p-[12px] text-ink"
          role="status"
        >
          This shortcut is not available on Mac.{" "}
          <button
            className="cursor-pointer border-0 bg-transparent p-0 [font:inherit] [font-weight:700] text-primary-strong underline"
            type="button"
            onClick={onSkip}
          >
            Skip this step
          </button>
        </div>
      ) : (
        <>
          {step.pics?.length ? (
            <div
              className="grid min-h-[180px] place-items-center overflow-hidden rounded-[10px] bg-surface-warm"
              aria-live="polite"
            >
              <img
                className="block max-h-[260px] max-w-full object-contain"
                src={step.pics[Math.min(sequenceIndex, step.pics.length - 1)]}
                alt={`Shortcut step ${sequenceIndex + 1}`}
              />
            </div>
          ) : view ? (
            <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden [&_.eg-sheet]:!min-w-[560px]">
              <Grid
                key={`${step.id}-${showPostcondition ? "after" : "before"}`}
                grid={view.grid}
                displayOnly
                activeCell={view.activeCell}
                selection={view.selection}
                highlightCells={[view.selection]}
                format={view.format}
                onDisplayClick={() => practiceRef.current?.focus({ preventScroll: true })}
              />
            </div>
          ) : (
            <div
              className="grid min-h-[140px] grid-cols-2 rounded-[8px] border border-solid border-border bg-surface-warm [&_span]:border [&_span]:border-solid [&_span]:border-border [&_span]:p-[18px] [&_span]:text-ink"
              aria-hidden="true"
            >
              <span>
                {showPostcondition
                  ? (step.postcondition?.selection ?? "A1")
                  : (step.activeCell ?? "A1")}
              </span>
              <span>
                {showPostcondition ? (step.postcondition?.grid?.[0]?.[0] ?? "Excel") : "Excel"}
              </span>
            </div>
          )}
          <p
            className={`mt-[14px] mb-0 inline-block rounded-full border border-solid border-border ${showPostcondition ? "" : "group-focus-visible:border-primary-strong group-focus-visible:[box-shadow:0_0_0_2px_var(--primary-tint)]"} bg-surface-warm px-[12px] py-[8px] font-[650] text-ink [overflow-wrap:anywhere]`}
            aria-live="polite"
          >
            {step.mode === "sequence" && sequenceIndex > 0
              ? `${sequenceIndex} of ${expected.length}: `
              : ""}
            {hint}
          </p>
          {showPostcondition &&
            step.postcondition &&
            (view ? (
              <span className="sr-only" role="status">
                After
              </span>
            ) : (
              <div
                className="mt-[12px] flex flex-wrap gap-[8px] text-[0.9rem] text-muted [&_span]:max-w-full [&_span]:rounded-[7px] [&_span]:border [&_span]:border-solid [&_span]:border-border [&_span]:px-[9px] [&_span]:py-[6px] [&_span]:[overflow-wrap:anywhere]"
                aria-label="After the shortcut"
              >
                {step.postcondition.selection && (
                  <span>Selection: {step.postcondition.selection}</span>
                )}
                {step.postcondition.grid && (
                  <span>{step.postcondition.grid.map((row) => row.join(" · ")).join(" / ")}</span>
                )}
              </div>
            ))}
        </>
      )}
    </section>
  );
}
