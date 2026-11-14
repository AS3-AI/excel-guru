import { describe, expect, it } from "vitest";
import { normaliseKeys, type KeyEventLike } from "../src/index";

const ev = (key: string, code: string, mods: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("normaliseKeys", () => {
  it("uppercases a plain letter", () => {
    expect(normaliseKeys(ev("a", "KeyA"))).toBe("A");
  });

  it("reads letters from code so Shift doesn't matter", () => {
    expect(normaliseKeys(ev("C", "KeyC", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+C");
  });

  it("reads Mac Alt-letters from code (Alt+H gives ˙ in key)", () => {
    expect(normaliseKeys(ev("˙", "KeyH", { altKey: true }))).toBe("Alt+H");
  });

  it("reads Mac Alt-digits from code (Alt+1 gives ¡ in key)", () => {
    expect(normaliseKeys(ev("¡", "Digit1", { altKey: true }))).toBe("Alt+1");
  });

  it("reads Shift+digit as the digit, not the symbol", () => {
    expect(normaliseKeys(ev("!", "Digit1", { shiftKey: true }))).toBe("Shift+1");
    expect(normaliseKeys(ev("$", "Digit4", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+4");
  });

  it("reads numpad digits as digits", () => {
    expect(normaliseKeys(ev("1", "Numpad1"))).toBe("1");
  });

  it("reads punctuation from code so Shift doesn't change it", () => {
    expect(normaliseKeys(ev(":", "Semicolon", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+;");
    expect(normaliseKeys(ev(";", "Semicolon", { ctrlKey: true }))).toBe("Ctrl+;");
    expect(normaliseKeys(ev("=", "Equal", { altKey: true }))).toBe("Alt+=");
  });

  it("orders modifiers Ctrl, Alt, Shift, Cmd", () => {
    expect(
      normaliseKeys(ev("ArrowDown", "ArrowDown", { metaKey: true, shiftKey: true, altKey: true, ctrlKey: true })),
    ).toBe("Ctrl+Alt+Shift+Cmd+ArrowDown");
    expect(normaliseKeys(ev("ArrowDown", "ArrowDown", { shiftKey: true, ctrlKey: true }))).toBe("Ctrl+Shift+ArrowDown");
  });

  it("maps metaKey to Cmd", () => {
    expect(normaliseKeys(ev("c", "KeyC", { metaKey: true }))).toBe("Cmd+C");
  });

  it("keeps named keys", () => {
    for (const k of ["Enter", "Tab", "Escape", "ArrowUp", "Home", "PageDown", "Delete", "Backspace"]) {
      expect(normaliseKeys(ev(k, k))).toBe(k);
    }
  });

  it("names the space bar Space", () => {
    expect(normaliseKeys(ev(" ", "Space", { shiftKey: true }))).toBe("Shift+Space");
  });

  it("keeps function keys F1–F24", () => {
    expect(normaliseKeys(ev("F2", "F2"))).toBe("F2");
    expect(normaliseKeys(ev("F4", "F4", { ctrlKey: true }))).toBe("Ctrl+F4");
    expect(normaliseKeys(ev("F24", "F24"))).toBe("F24");
  });

  it("returns a lone modifier press as just the modifier", () => {
    expect(normaliseKeys(ev("Alt", "AltLeft", { altKey: true }))).toBe("Alt");
    expect(normaliseKeys(ev("Control", "ControlRight", { ctrlKey: true }))).toBe("Ctrl");
    expect(normaliseKeys(ev("Shift", "ShiftLeft", { shiftKey: true }))).toBe("Shift");
    expect(normaliseKeys(ev("Meta", "MetaLeft", { metaKey: true }))).toBe("Cmd");
  });

  it("returns a modifier pressed while others are held as the held modifiers", () => {
    expect(normaliseKeys(ev("Shift", "ShiftLeft", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift");
  });

  it("counts a modifier key even if its flag is missing", () => {
    expect(normaliseKeys(ev("Alt", "AltLeft"))).toBe("Alt");
  });

  it("falls back to key when code is empty (synthetic events)", () => {
    expect(normaliseKeys(ev("b", "", { ctrlKey: true }))).toBe("Ctrl+B");
    expect(normaliseKeys(ev("Enter", ""))).toBe("Enter");
    expect(normaliseKeys(ev(" ", ""))).toBe("Space");
  });

  it("maps old key aliases to their standard names", () => {
    expect(normaliseKeys(ev("Esc", ""))).toBe("Escape");
    expect(normaliseKeys(ev("Down", ""))).toBe("ArrowDown");
  });

  it("needs no DOM: works on a plain object", () => {
    const plain = { key: "z", code: "KeyZ", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false };
    expect(normaliseKeys(plain)).toBe("Ctrl+Z");
  });
});
