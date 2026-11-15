import { describe, expect, it } from "vitest";
import { detectOS, isTouchDevice } from "./platform";
import { handleShortcutPress, shortcutSkipOutcome } from "../app/(app)/lesson/[id]/steps/ShortcutStep";
import type { ShortcutStep } from "@excel-guru/grader";
import { gradeSequenceStep, gradeShortcutStep } from "@excel-guru/grader";
import shortcutLesson from "../test-fixtures/shortcut-lesson.json";

describe("platform detection", () => {
  it.each([
    [{ userAgentData: { platform: "macOS" }, platform: "Win32" }, "mac"],
    [{ userAgentData: { platform: "Windows" }, platform: "MacIntel" }, "win"],
    [{ platform: "MacIntel" }, "mac"], [{ platform: "iPhone" }, "mac"],
    [{ platform: "iPad" }, "mac"], [{ platform: "Win32" }, "win"],
    [{ platform: "Linux x86_64" }, "win"], [{}, "win"],
  ] as const)("detects OS for %o", (source, expected) => expect(detectOS(source)).toBe(expected));

  it.each([[{ maxTouchPoints: 1 }, false, true], [{ maxTouchPoints: 0 }, true, true], [{ maxTouchPoints: 0 }, false, false], [undefined, false, false]] as const)(
    "detects touch input", (source, hasTouch, expected) => expect(isTouchDevice(source, hasTouch)).toBe(expected),
  );
});

describe("shortcut key handling", () => {
  const event = (key: string, extra: Partial<{ repeat: boolean; isComposing: boolean; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({
    key, code: extra.code ?? (key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : ""),
    ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, isComposing: false, ...extra,
  });
  it.each([
    [event("a", { repeat: true }), "chord", ["A"], 0, "ignored"],
    [event("a", { isComposing: true }), "chord", ["A"], 0, "ignored"],
    [event("Process"), "sequence", ["A"], 0, "ignored"],
    [event("Unidentified"), "sequence", ["A"], 0, "ignored"],
    [event("Shift"), "chord", ["Shift", "A"], 0, "ignored"],
    [event("Control"), "chord", ["Ctrl", "A"], 0, "ignored"],
    [event("Alt"), "chord", ["Alt", "A"], 0, "ignored"],
    [event("Meta"), "chord", ["Cmd", "A"], 0, "ignored"],
    [event("a"), "chord", ["A"], 0, "correct"],
    [event("b"), "chord", ["A"], 0, "wrong"],
    [event("a"), "sequence", ["A", "B"], 0, "progress"],
    [event("b"), "sequence", ["A", "B"], 1, "correct"],
    [event("b"), "sequence", ["A", "B"], 0, "wrong"],
    [event("a"), "sequence", ["A", "B"], 1, "wrong"],
    [event("a", { ctrlKey: true }), "sequence", ["A", "B"], 0, "wrong"],
    [event("Control"), "sequence", ["Ctrl+A", "Ctrl+C"], 0, "ignored"],
    [event("Shift"), "sequence", ["F2", "Shift+Home"], 1, "ignored"],
    [event("Escape"), "sequence", ["A"], 0, "ignored"],
    [event("Tab"), "sequence", ["A"], 0, "ignored"],
    [event("Tab", { shiftKey: true }), "sequence", ["A"], 0, "ignored"],
    [event("Tab"), "sequence", ["Tab"], 0, "correct"],
    [event("Escape"), "sequence", ["Escape"], 0, "correct"],
    [event("Control"), "sequence", ["Ctrl+A", "Ctrl+C"], 0, "ignored"],
    [event("Alt"), "sequence", ["Alt", "H", "1"], 0, "progress"],
  ] as const)("handles %s in %s mode", (e, mode, expected, index, status) => {
    expect(handleShortcutPress(e, mode, expected, index)).toMatchObject({ status });
  });
});

describe("shortcut lesson OS mappings", () => {
  const [chord, sequence] = shortcutLesson.steps as ShortcutStep[];
  it("grades the chord for Windows and Mac mappings", () => {
    expect(gradeShortcutStep(chord!, "Ctrl+Shift+ArrowDown", "win")).toBe(true);
    expect(gradeShortcutStep(chord!, "Shift+Cmd+ArrowDown", "mac")).toBe(true);
  });
  it("grades the sequence for Windows and skips a missing Mac mapping", () => {
    expect(gradeSequenceStep(sequence!, ["Alt", "H", "1"], "win")).toBe(true);
    expect(gradeSequenceStep(sequence!, ["Alt", "H", "1"], "mac")).toBe(false);
  });
  it("completes sequences whose entries are modified keys", () => {
    const keyEvent = (key: string, extra: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => ({ key, code: key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : "", ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...extra });
    const ctrl = [keyEvent("a", { ctrlKey: true }), keyEvent("c", { ctrlKey: true })];
    let index = 0;
    for (const e of ctrl) index = handleShortcutPress(e, "sequence", ["Ctrl+A", "Ctrl+C"], index).index;
    expect(index).toBe(2);
    const functionKeys = [keyEvent("F2"), keyEvent("Home", { shiftKey: true })];
    index = 0;
    for (const e of functionKeys) index = handleShortcutPress(e, "sequence", ["F2", "Shift+Home"], index).index;
    expect(index).toBe(2);
  });
});

describe("touch shortcut section skipping", () => {
  it.each([
    [[{ type: "shortcut" }], 0, 0, 1, "keyboard-required"],
    [[{ type: "shortcut" }, { type: "shortcut" }], 0, 0, 2, "keyboard-required"],
    [[{ type: "shortcut" }, { type: "formula" }], 0, 0, 1, "advance"],
    [[{ type: "shortcut" }, { type: "formula" }], 0, 0, 2, "advance"],
  ] as const)("handles remaining lesson steps %j", (steps, index, correct, required, expected) => {
    expect(shortcutSkipOutcome(steps, index, correct, required)).toBe(expected);
  });
});
