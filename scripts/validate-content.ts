// validate-content: checks every lesson in <dir>/lessons/<module>/<id>.json against
// Product spec §5, plus <dir>/order.json. Usage: tsx scripts/validate-content.ts [dir=content]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  gradeFormulaStep,
  type FormulaStep,
  type Lesson,
  type Postcondition,
  type SelectStep,
  type ShortcutChordStep,
  type ShortcutSequenceStep,
  type ShortcutStep,
  type Step,
  type StepType,
} from "@excel-guru/grader";

export type FileResult = { file: string; errors: string[] };
type Fail = (message: string) => void;
type Obj = Record<string, unknown>;

/** Validates a content directory. Returns only files that have errors; [] means valid. */
export function validateContent(dir: string): FileResult[] {
  const report = new Map<string, string[]>();
  const failFor = (file: string): Fail => (message) => {
    const list = report.get(file) ?? [];
    list.push(`${file}: ${message}`);
    report.set(file, list);
  };

  // Lesson files. File names count as known ids too, so an unparseable lesson
  // isn't also reported as missing from order.json.
  const lessons: { file: string; id: string }[] = [];
  const knownIds = new Set<string>();
  const lessonsDir = join(dir, "lessons");
  for (const module of listDir(lessonsDir)) {
    const moduleDir = join(lessonsDir, module);
    if (!statSync(moduleDir).isDirectory()) {
      failFor(moduleDir)("lesson files must live in lessons/<module>/<id>.json");
      continue;
    }
    for (const name of listDir(moduleDir)) {
      const file = join(moduleDir, name);
      const fail = failFor(file);
      if (statSync(file).isDirectory()) {
        fail("unexpected folder: lessons must sit directly in lessons/<module>/");
        continue;
      }
      if (!name.endsWith(".json")) {
        fail("unexpected file: only <id>.json lesson files belong in lessons/<module>/");
        continue;
      }
      const fileId = basename(name, ".json");
      knownIds.add(fileId);
      const data = readJson(file, fail);
      if (data === undefined) continue;
      const id = checkLesson(data, fileId, module, fail);
      if (id !== null) lessons.push({ file, id });
    }
  }

  // Lesson ids are unique across the course.
  const firstFile = new Map<string, string>();
  for (const { file, id } of lessons) {
    knownIds.add(id);
    const prior = firstFile.get(id);
    if (prior) failFor(file)(`lesson id "${id}" is also used by ${prior}`);
    else firstFile.set(id, file);
  }

  // order.json: every lesson exactly once, and no entry without a lesson.
  const orderPath = join(dir, "order.json");
  const orderFail = failFor(orderPath);
  const order = readOrder(orderPath, orderFail);
  if (order) {
    const counts = new Map<string, number>();
    for (const id of order) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      if (n > 1) orderFail(`lesson "${id}" is listed ${n} times; list it exactly once`);
      if (!knownIds.has(id)) orderFail(`names lesson "${id}" but no lessons/<module>/${id}.json exists`);
    }
    for (const [id, file] of firstFile) {
      if (!counts.has(id)) failFor(file)(`lesson "${id}" is not listed in ${orderPath}`);
    }
  }

  return [...report].map(([file, errors]) => ({ file, errors }));
}

/** Sorted entries, without dotfiles (.DS_Store, .gitkeep); [] if the folder is missing. */
function listDir(path: string): string[] {
  return existsSync(path) ? readdirSync(path).filter((n) => !n.startsWith(".")).sort() : [];
}

function readJson(file: string, fail: Fail): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`not valid JSON (${(e as Error).message})`);
    return undefined;
  }
}

function readOrder(file: string, fail: Fail): string[] | null {
  if (!existsSync(file)) {
    fail("order.json is missing; it must list every lesson id");
    return null;
  }
  const data = readJson(file, fail);
  if (data === undefined) return null;
  if (!Array.isArray(data) || !data.every((x) => typeof x === "string")) {
    fail("must be a JSON array of lesson ids");
    return null;
  }
  return data;
}

// --- shape helpers -----------------------------------------------------------

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isTexts = (v: unknown): v is string[] => isStrings(v) && v.length > 0;
const show = (v: unknown) => (v === undefined ? "nothing" : JSON.stringify(v));

function isGrid(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every(
      (row) =>
        Array.isArray(row) &&
        row.every((c) => c === null || ["string", "number", "boolean"].includes(typeof c)),
    )
  );
}

/** Every step type in the grader's StepType, in schema order; the Record keeps it exhaustive. */
const STEP_TYPES: Record<StepType, true> = {
  formula: true, select: true, shortcut: true, mcq: true, picture: true, project: true, info: true,
};
const isStepType = (t: unknown): t is StepType => typeof t === "string" && Object.hasOwn(STEP_TYPES, t);

type ErrorCode = Extract<FormulaStep["expectedValue"], { error: unknown }>["error"];
const ERROR_CODES: Record<ErrorCode, true> = {
  "#DIV/0!": true, "#N/A": true, "#VALUE!": true, "#REF!": true, "#NAME?": true, "#NUM!": true,
  "#SPILL!": true, "#CIRC!": true,
};

function isCellValue(v: unknown): boolean {
  if (v === null || ["string", "number", "boolean"].includes(typeof v)) return true;
  return (
    isObj(v) && Object.keys(v).length === 1 && typeof v.error === "string" && Object.hasOwn(ERROR_CODES, v.error)
  );
}

const CELL_RE = /^[A-Z]{1,3}[1-9]\d*$/;

// Allowed field names, one Record per type in the grader's types.ts: a missing or
// extra key here is a compile error, so these lists can't drift from the schema.
type Fields<T> = Record<keyof T, true>;
const LESSON_FIELDS: Fields<Lesson> = {
  id: true, module: true, title: true, difficulty: true, requiredCorrect: true, isIntro: true, video: true, steps: true,
};
const BASE = { id: true, type: true, activeCell: true, highlightCells: true, postcondition: true, mobileButtons: true } as const;
const STEP_FIELDS: { [T in StepType]: Fields<Extract<Step, { type: T }>> } = {
  formula: { ...BASE, prompt: true, grid: true, targetCell: true, expectedValue: true, mustUse: true, solution: true, explain: true },
  select: { ...BASE, prompt: true, grid: true, target: true },
  shortcut: { ...BASE, mode: true, prompt: true, keys: true, pics: true, grid: true },
  mcq: { ...BASE, prompt: true, options: true, answer: true },
  picture: { ...BASE, prompt: true, image: true, accept: true },
  project: { ...BASE, prompt: true, file: true, accept: true },
  info: { ...BASE, text: true },
};
const POSTCONDITION_FIELDS: Fields<Postcondition> = { grid: true, selection: true, format: true };
const KEYS_FIELDS: Fields<ShortcutChordStep["keys"]> & Fields<ShortcutSequenceStep["keys"]> = { win: true, mac: true };

/** Reports keys of `obj` outside `allowed`, suggesting a case/underscore/hyphen variant. */
function checkFields(obj: Obj, allowed: Record<string, true>, prefix: string, fail: Fail) {
  const squash = (s: string) => s.replace(/[_-]/g, "").toLowerCase();
  for (const key of Object.keys(obj)) {
    if (Object.hasOwn(allowed, key)) continue;
    const near = Object.keys(allowed).find((a) => squash(a) === squash(key));
    fail(`unknown field "${prefix}${key}"${near ? ` (did you mean "${prefix}${near}"?)` : ""}`);
  }
}

// --- lesson ------------------------------------------------------------------

/** Checks one lesson; returns its id if it has a usable one (for uniqueness and order.json). */
function checkLesson(data: unknown, fileId: string, folder: string, fail: Fail): string | null {
  if (!isObj(data)) {
    fail("not a lesson: expected a JSON object");
    return null;
  }
  const { id, module, title, difficulty, requiredCorrect, isIntro, video, steps } = data;

  if (!isText(id)) fail(`id must be a non-empty string (got ${show(id)})`);
  else if (id !== fileId) fail(`id "${id}" must match the file name "${fileId}"`);
  if (!isText(module)) fail(`module must be a non-empty string (got ${show(module)})`);
  else if (module !== folder) fail(`module "${module}" must match the folder name "${folder}"`);
  if (!isText(title)) fail("title must be a non-empty string");
  if (difficulty !== 1 && difficulty !== 2 && difficulty !== 3) fail(`difficulty must be 1, 2 or 3 (got ${show(difficulty)})`);
  const requiredOk = Number.isInteger(requiredCorrect) && (requiredCorrect as number) > 0;
  if (!requiredOk) fail(`requiredCorrect must be a positive integer (got ${show(requiredCorrect)})`);
  if (typeof isIntro !== "boolean") fail(`isIntro must be a boolean (got ${show(isIntro)})`);
  if (video !== null && typeof video !== "string") fail(`video must be a string or null (got ${show(video)})`);
  checkFields(data, LESSON_FIELDS, "", (m) => fail(`lesson: ${m}`));
  if (!Array.isArray(steps) || steps.length === 0) {
    fail("steps must be a non-empty array");
    return isText(id) ? id : null;
  }

  const seen = new Set<string>();
  const reported = new Set<string>();
  let gradable = 0;
  steps.forEach((step: unknown, i) => {
    const label = isObj(step) && isText(step.id) ? `step "${step.id}"` : `step #${i + 1}`;
    const stepFail: Fail = (m) => fail(`${label}: ${m}`);
    if (!isObj(step)) return stepFail("must be an object");
    if (!isText(step.id)) stepFail("missing id (every step needs a non-empty string id)");
    else if (seen.has(step.id)) {
      if (!reported.has(step.id)) stepFail("id is used by more than one step");
      reported.add(step.id);
    } else seen.add(step.id);

    if (!isStepType(step.type)) {
      return stepFail(`unknown type ${show(step.type)} (expected one of: ${Object.keys(STEP_TYPES).join(", ")})`);
    }
    if (step.type === "shortcut" && step.mode !== "chord" && step.mode !== "sequence") {
      return stepFail(`shortcut mode ${show(step.mode)} must be "chord" or "sequence"`);
    }
    if (step.type !== "info") gradable++;

    // Unknown names don't invalidate the known fields, so they don't block the content checks.
    checkFields(step, STEP_FIELDS[step.type], "", stepFail);
    if (isObj(step.postcondition)) checkFields(step.postcondition, POSTCONDITION_FIELDS, "postcondition.", stepFail);
    if (step.type === "shortcut" && isObj(step.keys)) checkFields(step.keys, KEYS_FIELDS, "keys.", stepFail);

    let shapeErrors = 0;
    const shapeFail: Fail = (m) => {
      shapeErrors++;
      stepFail(m);
    };
    checkStepShape(step, shapeFail);
    if (shapeErrors === 0) checkStepContent(step as Step, stepFail);
  });

  if (requiredOk && gradable < (requiredCorrect as number)) {
    fail(
      `requiredCorrect is ${requiredCorrect} but the lesson has only ${gradable} ` +
        `gradable step${gradable === 1 ? "" : "s"} (non-info)`,
    );
  }
  return isText(id) ? id : null;
}

// --- step shape (grader types.ts) --------------------------------------------

/** Structural check of one step whose type (and shortcut mode) is already known valid. */
function checkStepShape(s: Obj, fail: Fail) {
  // StepBase optional fields.
  if (s.activeCell !== undefined && typeof s.activeCell !== "string") fail("activeCell must be a string");
  if (s.highlightCells !== undefined && !isStrings(s.highlightCells)) fail("highlightCells must be an array of strings");
  if (s.postcondition !== undefined) {
    if (!isObj(s.postcondition)) fail("postcondition must be an object");
    else {
      const { grid, selection } = s.postcondition;
      if (grid !== undefined && !isGrid(grid)) fail("postcondition.grid must be an array of rows of strings, numbers, booleans or null");
      if (selection !== undefined && typeof selection !== "string") fail("postcondition.selection must be a string");
      if (s.postcondition.format !== undefined) {
        if (s.type !== "shortcut") fail("postcondition.format is only allowed on shortcut steps");
        else if (!isObj(s.postcondition.format) || Object.entries(s.postcondition.format).some(([, styles]) => !Array.isArray(styles) || !styles.every((style) => typeof style === "string"))) fail("postcondition.format must map cell or range references to arrays of styles");
      }
    }
  }
  if (s.mobileButtons !== undefined && !isStrings(s.mobileButtons)) fail("mobileButtons must be an array of strings");

  const need = (field: string, ok: boolean, what: string) => {
    if (!ok) fail(`${field} must be ${what}`);
  };
  const prompt = () => need("prompt", isText(s.prompt), "a non-empty string");
  const grid = () => need("grid", isGrid(s.grid), "an array of rows of strings, numbers, booleans or null");
  const accept = () => need("accept", isTexts(s.accept), "a non-empty array of strings");

  switch (s.type as StepType) {
    case "formula":
      prompt();
      grid();
      if (typeof s.targetCell !== "string" || !CELL_RE.test(s.targetCell)) {
        fail(`targetCell ${show(s.targetCell)} must be an uppercase cell reference like "B2"`);
      }
      need(
        "expectedValue",
        isCellValue(s.expectedValue),
        `a number, string, boolean, null or { "error": ${Object.keys(ERROR_CODES).map((c) => `"${c}"`).join(" | ")} }`,
      );
      if (s.mustUse !== undefined) need("mustUse", isStrings(s.mustUse), "an array of function names");
      need("solution", typeof s.solution === "string", "a string");
      if (s.explain !== undefined) need("explain", typeof s.explain === "string", "a string");
      return;
    case "select":
      prompt();
      grid();
      need("target", typeof s.target === "string", "a string");
      return;
    case "shortcut": {
      prompt();
      const chord = s.mode === "chord";
      if (!isObj(s.keys)) return fail("keys must be an object with win and mac");
      const { win, mac } = s.keys;
      if (chord) {
        need("keys.win", typeof win === "string", "a string for a chord");
        need("keys.mac", typeof mac === "string" || mac === null, "a string or null for a chord");
      } else {
        need("keys.win", isTexts(win), "a non-empty array of strings for a sequence");
        need("keys.mac", isTexts(mac) || mac === null, "a non-empty array of strings or null for a sequence");
      }
      if (s.pics !== undefined) need("pics", isStrings(s.pics), "an array of strings");
      if (s.grid !== undefined && !isGrid(s.grid)) fail("grid must be an array of rows of strings, numbers, booleans or null");
      return;
    }
    case "mcq": {
      prompt();
      const optionsOk = isTexts(s.options);
      need("options", optionsOk, "a non-empty array of strings");
      if (!Number.isInteger(s.answer)) fail(`answer must be an integer (got ${show(s.answer)})`);
      else if (optionsOk) {
        const n = (s.options as string[]).length;
        const a = s.answer as number;
        if (a < 0 || a >= n) fail(`answer ${a} is not an index into options (0..${n - 1})`);
      }
      return;
    }
    case "picture":
      prompt();
      need("image", isText(s.image), "a non-empty string");
      accept();
      return;
    case "project":
      prompt();
      need("file", isText(s.file), "a non-empty string");
      accept();
      return;
    case "info":
      need("text", isText(s.text), "a non-empty string");
      return;
  }
}

/** Content rules for a step whose shape is valid. */
function checkStepContent(step: Step, fail: Fail) {
  if (step.type === "formula") checkFormula(step, fail);
  else if (step.type === "select") checkSelect(step, fail);
  else if (step.type === "shortcut") checkShortcut(step, fail);
}

// --- formula ---------------------------------------------------------------

function checkFormula(step: FormulaStep, fail: Fail) {
  let result;
  try {
    result = gradeFormulaStep(step, step.solution);
  } catch (e) {
    return fail(`solution "${step.solution}" crashed the grader (${(e as Error).message})`);
  }
  if (result.correct) return;
  const detail =
    result.reason === "wrong_value"
      ? `; expected ${JSON.stringify(step.expectedValue)}`
      : result.reason === "missing_function"
        ? `; mustUse ${(step.mustUse ?? []).join(", ")}`
        : "";
  fail(`solution "${step.solution}" is not graded correct (${result.reason}${detail})`);
}

// --- select ----------------------------------------------------------------

type Part = { kind: "cell"; row: number; col: number } | { kind: "col"; col: number } | { kind: "row"; row: number };

function parsePart(s: string): Part | null {
  let m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(s);
  if (m) return { kind: "cell", col: columnIndex(m[1]!), row: Number(m[2]) - 1 };
  m = /^([A-Z]{1,3})$/.exec(s);
  if (m) return { kind: "col", col: columnIndex(m[1]!) };
  m = /^([1-9]\d*)$/.exec(s);
  if (m) return { kind: "row", row: Number(m[1]) - 1 };
  return null;
}

/** "A" → 0, "AA" → 26. */
function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function columnLetters(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Parses "B2", "B2:C4", "B:B" or "3:3" (any case, either corner first) into the
 * area it names plus its canonical spelling; null if malformed.
 */
function parseTarget(target: string): { parts: Part[]; canonical: string } | null {
  const pieces = target.toUpperCase().split(":");
  if (pieces.length === 1) {
    const p = parsePart(pieces[0]!);
    return p?.kind === "cell" ? { parts: [p], canonical: pieces[0]! } : null;
  }
  if (pieces.length !== 2) return null;
  const a = parsePart(pieces[0]!);
  const b = parsePart(pieces[1]!);
  if (!a || !b) return null;
  if (a.kind === "cell" && b.kind === "cell") {
    const tl = `${columnLetters(Math.min(a.col, b.col))}${Math.min(a.row, b.row) + 1}`;
    const br = `${columnLetters(Math.max(a.col, b.col))}${Math.max(a.row, b.row) + 1}`;
    return { parts: [a, b], canonical: tl === br ? tl : `${tl}:${br}` };
  }
  if (a.kind === "col" && b.kind === "col") {
    const [l, r] = [Math.min(a.col, b.col), Math.max(a.col, b.col)];
    return { parts: [a, b], canonical: `${columnLetters(l)}:${columnLetters(r)}` };
  }
  if (a.kind === "row" && b.kind === "row") {
    const [t, btm] = [Math.min(a.row, b.row), Math.max(a.row, b.row)];
    return { parts: [a, b], canonical: `${t + 1}:${btm + 1}` };
  }
  return null;
}

function checkSelect(step: SelectStep, fail: Fail) {
  const parsed = parseTarget(step.target);
  if (!parsed) return fail(`target "${step.target}" is not a cell, range, column or row`);
  if (parsed.canonical !== step.target) {
    fail(
      `target "${step.target}" is not canonical; write "${parsed.canonical}" ` +
        "(uppercase, top-left corner first, a single cell as one reference)",
    );
  }

  const rows = step.grid.length;
  const cols = Math.max(0, ...step.grid.map((r) => r.length));
  const inside = parsed.parts.every((p) => {
    const rowOk = p.kind === "col" ? rows > 0 : p.row < rows;
    const colOk = p.kind === "row" ? cols > 0 : p.col < cols;
    return rowOk && colOk;
  });
  if (!inside) {
    const extent = rows && cols ? `A1:${columnLetters(cols - 1)}${rows}` : "empty";
    fail(`target "${step.target}" is outside the grid (${extent})`);
  }
}

// --- shortcuts -------------------------------------------------------------
// Canonical form (spec §4, normaliseKeys): modifiers Ctrl, Alt, Shift, Cmd in that
// order, joined by "+", then one key: a single printable ASCII character (letters
// uppercase) or a KeyboardEvent key name such as ArrowDown, Tab or F5.

const MODIFIERS = ["Ctrl", "Alt", "Shift", "Cmd"] as const;
type Modifier = (typeof MODIFIERS)[number];
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
const CANONICAL_HINT = "(modifiers Ctrl, Alt, Shift, Cmd in that order, then one key)";
const RESERVED_KEYS = new Set(["W", "T", "N", "Q", "Tab"]);
const SHIFTED_US_KEYS: Record<string, string> = { "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "~": "`" };

type Combo = { mods: Set<Modifier>; key: string | null };

/** Reads a combo in any spelling ("⌘W", "shift+ctrl+c"); null if it can't be understood. */
function parseCombo(combo: string): Combo | null {
  const mods = new Set<Modifier>();
  const keys: string[] = [];
  for (const raw of combo.split("+")) {
    let token = raw.trim();
    // Mac symbols can be glued on: "⌘⇧W".
    while (token.length > 1 && MODIFIER_ALIASES[token[0]!]) {
      mods.add(MODIFIER_ALIASES[token[0]!]!);
      token = token.slice(1);
    }
    if (token === "") return null;
    const mod = MODIFIER_ALIASES[token.toLowerCase()];
    if (mod) mods.add(mod);
    else if (/^[!-~]$/.test(token)) keys.push(token.toUpperCase());
    else if (NAMED_KEY_BY_LOWER.has(token.toLowerCase())) keys.push(NAMED_KEY_BY_LOWER.get(token.toLowerCase())!);
    else return null;
  }
  return keys.length > 1 ? null : { mods, key: keys[0] ?? null };
}

const formatCombo = ({ mods, key }: Combo) =>
  [...MODIFIERS.filter((m) => mods.has(m)), ...(key === null ? [] : [key])].join("+");

/** Ctrl/Cmd + W, T, N, Q or Tab, with or without other modifiers: the browser keeps these. */
export function isReservedCombo(combo: string): boolean {
  const c = parseCombo(combo);
  return !!c && c.key !== null && RESERVED_KEYS.has(c.key) && (c.mods.has("Ctrl") || c.mods.has("Cmd"));
}

function checkCombo(combo: string, bareModifierOk: boolean, label: string, fail: Fail) {
  const c = parseCombo(combo);
  if (!c) return fail(`${label} "${combo}" is not canonical ${CANONICAL_HINT}`);
  if (c.key && Object.hasOwn(SHIFTED_US_KEYS, c.key)) {
    const mods = new Set(c.mods);
    mods.add("Shift");
    fail(`${label} "${combo}" uses shifted US symbol "${c.key}"; write "${formatCombo({ mods, key: SHIFTED_US_KEYS[c.key]! })}" instead`);
  }
  if (c.key === null && !(bareModifierOk && c.mods.size === 1)) {
    fail(`${label} "${combo}" has no key after its modifiers`);
  } else {
    const canonical = formatCombo(c);
    if (canonical !== combo) fail(`${label} "${combo}" is not canonical; write "${canonical}" ${CANONICAL_HINT}`);
  }
  if (isReservedCombo(combo)) fail(`${label} "${combo}" uses a browser-reserved combo (Ctrl/Cmd + W, T, N, Q, Tab)`);
}

const ALLOWED_FORMAT_STYLES = new Set(["bold", "italic", "underline", "strikethrough", "center", "border"]);

function checkShortcutGrid(grid: unknown[][], label: string, fail: Fail): { rows: number; cols: number } | null {
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((row) => (Array.isArray(row) ? row.length : 0)));
  if (rows === 0 || cols === 0) {
    fail(`${label} must not be empty`);
    return null;
  }
  if (cols > 7 || rows > 8) fail(`${label} must have at most 7 columns and 8 rows`);
  if (grid.some((row) => !Array.isArray(row) || row.length !== cols)) fail(`${label} rows must have equal length`);
  return { rows, cols };
}

function isInside(ref: string, rows: number, cols: number): boolean {
  const parsed = parseTarget(ref);
  return (
    !!parsed &&
    parsed.parts.every((part) =>
      part.kind === "col"
        ? rows > 0 && part.col < cols
        : part.kind === "row"
          ? cols > 0 && part.row < rows
          : part.row < rows && part.col < cols,
    )
  );
}

function checkShortcut(step: ShortcutStep, fail: Fail) {
  for (const os of ["win", "mac"] as const) {
    const keys = step.keys[os];
    if (keys === null) continue;
    // A sequence entry may be a lone modifier, e.g. the "Alt" that opens key tips.
    for (const combo of Array.isArray(keys) ? keys : [keys]) checkCombo(combo, step.mode === "sequence", `${os} shortcut`, fail);
  }

  const stepGridDim = step.grid ? checkShortcutGrid(step.grid, "grid", fail) : null;
  const postGridDim = step.postcondition?.grid ? checkShortcutGrid(step.postcondition.grid, "postcondition.grid", fail) : null;

  if (step.activeCell && stepGridDim && !isInside(step.activeCell, stepGridDim.rows, stepGridDim.cols)) {
    fail(`activeCell "${step.activeCell}" is outside the grid`);
  }

  const targetDim = step.postcondition?.grid ? postGridDim : stepGridDim;
  const selection = step.postcondition?.selection;
  if (selection && targetDim && !isInside(selection, targetDim.rows, targetDim.cols)) {
    fail(`postcondition.selection "${selection}" is outside the grid`);
  }

  for (const [ref, styles] of Object.entries(step.postcondition?.format ?? {})) {
    if (targetDim && !isInside(ref, targetDim.rows, targetDim.cols)) {
      fail(`postcondition.format key "${ref}" is outside the grid`);
    }
    for (const style of styles) {
      if (!ALLOWED_FORMAT_STYLES.has(style)) fail(`postcondition.format style "${style}" is not allowed`);
    }
  }
}

// --- CLI -------------------------------------------------------------------

function main() {
  const dir = process.argv[2] ?? "content";
  const results = validateContent(dir);
  if (results.length === 0) {
    console.log(`validate-content: ${dir} is valid`);
    return;
  }
  for (const { errors } of results) for (const e of errors) console.error(`✗ ${e}`);
  const count = results.reduce((n, r) => n + r.errors.length, 0);
  console.error(`validate-content: ${count} error${count === 1 ? "" : "s"} in ${results.length} file${results.length === 1 ? "" : "s"}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
