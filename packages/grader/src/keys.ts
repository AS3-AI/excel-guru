// Keyboard combos in canonical form (docs/SPEC.md §4): modifiers Ctrl, Alt, Shift, Cmd in
// that order, joined by "+", then one key — a single printable ASCII character (letters
// uppercase) or a KeyboardEvent key name such as ArrowDown, Enter, Tab, Space or F5.
// These rules match the ones scripts/validate-content.ts enforces on lesson content.

/** The KeyboardEvent fields normaliseKeys reads; a DOM KeyboardEvent satisfies it. */
export type KeyEventLike = {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

const MODIFIERS = ["Ctrl", "Alt", "Shift", "Cmd"] as const;
type Modifier = (typeof MODIFIERS)[number];

/** Spellings of each modifier, lower-cased; covers both event.key values and lesson text. */
const MODIFIER_ALIASES: Record<string, Modifier> = {
  ctrl: "Ctrl", control: "Ctrl", "⌃": "Ctrl",
  alt: "Alt", option: "Alt", opt: "Alt", "⌥": "Alt",
  shift: "Shift", "⇧": "Shift",
  cmd: "Cmd", command: "Cmd", meta: "Cmd", "⌘": "Cmd",
};

const NAMED_KEYS = [
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab", "Escape", "Backspace", "Delete",
  "Insert", "Home", "End", "PageUp", "PageDown", "Space", "ContextMenu",
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
];
const NAMED_KEY_BY_LOWER = new Map(NAMED_KEYS.map((k) => [k.toLowerCase(), k]));

/** Legacy event.key values (old Edge/IE) mapped to their standard names. */
const KEY_ALIASES: Record<string, string> = {
  " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete",
  Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight", Apps: "ContextMenu",
};

/** US-layout punctuation by physical key, unshifted, so Shift doesn't change the key. */
const PUNCTUATION_BY_CODE: Record<string, string> = {
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";",
  Quote: "'", Comma: ",", Period: ".", Slash: "/", Backquote: "`",
};

const FLAG: Record<Modifier, keyof KeyEventLike> = { Ctrl: "ctrlKey", Alt: "altKey", Shift: "shiftKey", Cmd: "metaKey" };

/**
 * Canonical combo for a keydown, e.g. "Ctrl+Shift+ArrowDown". Letters, digits and
 * punctuation come from `code` so Shift and Mac Option don't change them (Alt+H, not "˙";
 * Shift+1, not "!"). A modifier press on its own returns the held modifiers ("Alt").
 */
export function normaliseKeys(e: KeyEventLike): string {
  const mods = new Set<Modifier>(MODIFIERS.filter((m) => e[FLAG[m]] === true));
  const pressedModifier = MODIFIER_ALIASES[e.key.toLowerCase()];
  if (pressedModifier) {
    mods.add(pressedModifier);
    return format(mods, null);
  }
  return format(mods, keyName(e));
}

function keyName({ key, code }: KeyEventLike): string {
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1]!;
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1]!;
  // With NumLock off a numpad digit key sends End, Home, arrows… in `key`; use that.
  m = /^Numpad(\d)$/.exec(code);
  if (m && /^\d$/.test(key)) return m[1]!;
  if (Object.hasOwn(PUNCTUATION_BY_CODE, code)) return PUNCTUATION_BY_CODE[code]!;
  return canonicalKey(KEY_ALIASES[key] ?? key) ?? key;
}

/** One key token in canonical spelling, or null if it isn't a key the canonical form allows. */
function canonicalKey(token: string): string | null {
  if (/^[!-~]$/.test(token)) return token.toUpperCase();
  return NAMED_KEY_BY_LOWER.get(token.toLowerCase()) ?? null;
}

function format(mods: Set<Modifier>, key: string | null): string {
  return [...MODIFIERS.filter((m) => mods.has(m)), ...(key === null ? [] : [key])].join("+");
}

/**
 * Rewrites a combo in canonical form ("shift+ctrl+arrowdown" → "Ctrl+Shift+ArrowDown");
 * null if it isn't a combo: an unknown token, more than one key, or nothing at all.
 */
export function canonicalCombo(combo: string): string | null {
  const mods = new Set<Modifier>();
  let key: string | null = null;
  for (const raw of combo.split("+")) {
    const token = raw.trim();
    if (token === "") return null;
    const mod = MODIFIER_ALIASES[token.toLowerCase()];
    if (mod) {
      mods.add(mod);
      continue;
    }
    const k = canonicalKey(token);
    if (k === null || key !== null) return null;
    key = k;
  }
  return format(mods, key);
}
