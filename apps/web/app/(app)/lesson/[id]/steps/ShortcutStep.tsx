"use client";

import { useMemo, useState } from "react";
import type { ShortcutStep as ShortcutStepType, Os } from "@excel-guru/grader";
import { normaliseKeys } from "@excel-guru/grader";
import type { KeyEventLike } from "@excel-guru/grader";
import "./shortcut.css";

type Mode = "chord" | "sequence";
type PressEvent = KeyEventLike & { repeat?: boolean; isComposing?: boolean };
export type PressResult = { status: "ignored" | "progress" | "correct" | "wrong"; index: number; input: string };
export function shortcutSkipOutcome(steps: readonly { type: string }[], index: number, correct: number, requiredCorrect: number): "advance" | "keyboard-required" {
  const remaining = steps.slice(index);
  const reachable = correct + remaining.filter((candidate) => candidate.type !== "shortcut" && candidate.type !== "info").length;
  return remaining.every((candidate) => candidate.type === "shortcut") && reachable < requiredCorrect ? "keyboard-required" : "advance";
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "OS"]);
const RESERVED = new Set(["Ctrl+W", "Ctrl+T", "Ctrl+N", "Ctrl+Q", "Ctrl+Tab", "Cmd+W", "Cmd+T", "Cmd+N", "Cmd+Q", "Cmd+Tab"]);
const isReserved = (combo: string) => RESERVED.has(combo);
const isModifierCombo = (combo: string) => combo !== "" && combo.split("+").every((part) => ["Ctrl", "Alt", "Shift", "Cmd"].includes(part));

/** Pure keyboard transition shared by the player and unit tests. */
export function handleShortcutPress(event: PressEvent, mode: Mode, expected: readonly string[], index: number): PressResult {
  const unchanged = (status: PressResult["status"]): PressResult => ({ status, index, input: "" });
  if (event.repeat || event.isComposing || event.key === "Process" || event.key === "Unidentified") return unchanged("ignored");
  const pressed = normaliseKeys(event);
  if (mode === "chord" && (MODIFIER_KEYS.has(event.key) || isModifierCombo(pressed))) return unchanged("ignored");
  if ((event.key === "Escape" || event.key === "Tab") && !expected.includes(pressed)) return unchanged("ignored");
  if (mode === "sequence" && MODIFIER_KEYS.has(event.key) && expected[index] !== pressed) return unchanged("ignored");
  if (mode === "chord") return { status: pressed === expected[0] ? "correct" : "wrong", index: 0, input: pressed };
  if (index >= expected.length) index = 0;
  if (pressed !== expected[index]) return { status: "wrong", index: 0, input: [...expected.slice(0, index), pressed].join(" ⟶ ") };
  const nextIndex = index + 1;
  return { status: nextIndex === expected.length ? "correct" : "progress", index: nextIndex, input: expected.slice(0, nextIndex).join(" ⟶ ") };
}

function pretty(key: string, os: Os): string {
  return key.replace(/Arrow(Up|Down|Left|Right)/g, "$1").replace("Cmd", os === "mac" ? "⌘" : "Win").replace("Ctrl", os === "mac" ? "⌃" : "Ctrl").replace("Alt", os === "mac" ? "⌥" : "Alt").replace("Shift", os === "mac" ? "⇧" : "Shift");
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
  return parts.length ? `Hold ${parts.map((part) => pretty(part, os)).join(" + ")}, press ${pretty(key, os)}` : `Press ${pretty(key, os)}`;
}

export function ShortcutStep({ step, os, touch, showPostcondition, onAttempt, onSkip, onSkipSection, onPracticeReady }:{ step: ShortcutStepType; os: Os; touch: boolean; showPostcondition?: boolean; onAttempt:(input:string, correct:boolean)=>void; onSkip:()=>void; onSkipSection:()=>void; onPracticeReady?:(node:HTMLElement|null)=>void }) {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const keys = step.keys[os];
  const expected = useMemo(() => keys === null ? [] : Array.isArray(keys) ? keys : [keys], [keys]);
  const isMissingMac = os === "mac" && keys === null;
  const hint = keyHint(step, os);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (keys === null || event.defaultPrevented) return;
    const result = handleShortcutPress(event, step.mode, expected, sequenceIndex);
    if (result.status === "ignored") return;
    const pressed = normaliseKeys(event);
    const usedCombo = step.mode === "chord" ? result.input === expected[0] : pressed === expected[sequenceIndex];
    if (usedCombo && !isReserved(pressed)) { event.preventDefault(); if (pressed.endsWith("Escape")) event.stopPropagation(); }
    if (step.mode === "sequence") setSequenceIndex(result.index);
    if (step.mode === "sequence" && result.status === "progress") return;
    onAttempt(result.input, result.status === "correct");
    if (step.mode === "sequence" && result.status === "wrong") setSequenceIndex(0);
  };

  return <section className="shortcut-practice" tabIndex={0} aria-label="Shortcut practice area" onKeyDown={onKeyDown} ref={onPracticeReady}>
    {touch && <div className="shortcut-banner" role="status">Mobile device detected — <button type="button" onClick={onSkipSection}>Skip section</button></div>}
    <p className="shortcut-prompt">{step.prompt}</p>
    {isMissingMac ? <div className="shortcut-skip" role="status">This shortcut is not available on Mac. <button type="button" onClick={onSkip}>Skip this step</button></div> : <>
      {step.pics?.length ? <div className="shortcut-picture" aria-live="polite"><img src={step.pics[Math.min(sequenceIndex, step.pics.length - 1)]} alt={`Shortcut step ${sequenceIndex + 1}`} /></div> : <div className="shortcut-grid" aria-hidden="true"><span>{showPostcondition ? step.postcondition?.selection ?? "A1" : "A1"}</span><span>{showPostcondition ? step.postcondition?.grid?.[0]?.[0] ?? "Excel" : "Excel"}</span></div>}
      <p className="shortcut-hint" aria-live="polite">{step.mode === "sequence" && sequenceIndex > 0 ? `${sequenceIndex} of ${expected.length}: ` : ""}{hint}</p>
      {showPostcondition && step.postcondition && <div className="shortcut-postcondition" aria-label="After the shortcut">{step.postcondition.selection && <span>Selection: {step.postcondition.selection}</span>}{step.postcondition.grid && <span>{step.postcondition.grid.map((row) => row.join(" · ")).join(" / ")}</span>}</div>}
    </>}
  </section>;
}
