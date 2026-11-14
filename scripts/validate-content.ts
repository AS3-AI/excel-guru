// validate-content: checks every lesson in <dir>/lessons/<module>/<id>.json against
// Product spec §5, plus <dir>/order.json. Usage: tsx scripts/validate-content.ts [dir=content]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gradeFormulaStep, type FormulaStep, type Grid, type Lesson, type SelectStep, type ShortcutStep } from "@excel-guru/grader";

export type FileResult = { file: string; errors: string[] };

/** Validates a content directory. Returns only files that have errors; [] means valid. */
export function validateContent(dir: string): FileResult[] {
  const report = new Map<string, string[]>();
  const fail = (file: string, message: string) => {
    const list = report.get(file) ?? [];
    list.push(`${file}: ${message}`);
    report.set(file, list);
  };

  // Lesson files: id -> first file that declared it. File names count too, so an
  // unparseable lesson isn't also reported as missing from order.json.
  const lessons: { file: string; lesson: Lesson }[] = [];
  const knownIds = new Set<string>();
  const lessonsDir = join(dir, "lessons");
  const entries = existsSync(lessonsDir) ? readdirSync(lessonsDir).sort() : [];
  for (const module of entries) {
    const moduleDir = join(lessonsDir, module);
    if (!statSync(moduleDir).isDirectory()) {
      if (module.endsWith(".json")) fail(moduleDir, "lesson files must live in lessons/<module>/<id>.json");
      continue;
    }
    for (const name of readdirSync(moduleDir).sort()) {
      if (!name.endsWith(".json")) continue;
      const file = join(moduleDir, name);
      knownIds.add(basename(name, ".json"));
      const lesson = readLesson(file, (m) => fail(file, m));
      if (!lesson) continue;
      checkLesson(lesson, basename(name, ".json"), module, (m) => fail(file, m));
      lessons.push({ file, lesson });
    }
  }

  // Lesson ids are unique across the course.
  const firstFile = new Map<string, string>();
  for (const { file, lesson } of lessons) {
    knownIds.add(lesson.id);
    const prior = firstFile.get(lesson.id);
    if (prior) fail(file, `lesson id "${lesson.id}" is also used by ${prior}`);
    else firstFile.set(lesson.id, file);
  }

  // order.json: every lesson exactly once, and no entry without a lesson.
  const orderPath = join(dir, "order.json");
  const order = readOrder(orderPath, (m) => fail(orderPath, m));
  if (order) {
    const counts = new Map<string, number>();
    for (const id of order) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, n] of counts) {
      if (n > 1) fail(orderPath, `lesson "${id}" is listed ${n} times; list it exactly once`);
      if (!knownIds.has(id)) fail(orderPath, `names lesson "${id}" but no lessons/<module>/${id}.json exists`);
    }
    for (const [id, file] of firstFile) {
      if (!counts.has(id)) fail(file, `lesson "${id}" is not listed in ${orderPath}`);
    }
  }

  return [...report].map(([file, errors]) => ({ file, errors }));
}

function readLesson(file: string, fail: (m: string) => void): Lesson | null {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`not valid JSON (${(e as Error).message})`);
    return null;
  }
  if (typeof data !== "object" || data === null || !Array.isArray((data as Lesson).steps)) {
    fail("not a lesson: expected an object with a steps array");
    return null;
  }
  return data as Lesson;
}

function readOrder(file: string, fail: (m: string) => void): string[] | null {
  if (!existsSync(file)) {
    fail("order.json is missing; it must list every lesson id");
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`not valid JSON (${(e as Error).message})`);
    return null;
  }
  if (!Array.isArray(data) || !data.every((x) => typeof x === "string")) {
    fail("must be a JSON array of lesson ids");
    return null;
  }
  return data;
}

function checkLesson(lesson: Lesson, fileId: string, folder: string, fail: (m: string) => void) {
  if (lesson.id !== fileId) fail(`id "${lesson.id}" must match the file name "${fileId}"`);
  if (lesson.module !== folder) fail(`module "${lesson.module}" must match the folder name "${folder}"`);

  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const step of lesson.steps) {
    if (seen.has(step.id) && !reported.has(step.id)) {
      fail(`step "${step.id}": id is used by more than one step`);
      reported.add(step.id);
    }
    seen.add(step.id);

    const stepFail = (m: string) => fail(`step "${step.id}": ${m}`);
    if (step.type === "formula") checkFormula(step, stepFail);
    else if (step.type === "select") checkSelect(step, stepFail);
    else if (step.type === "shortcut") checkShortcut(step, stepFail);
  }

  const gradable = lesson.steps.filter((s) => s.type !== "info").length;
  if (gradable < lesson.requiredCorrect) {
    fail(
      `requiredCorrect is ${lesson.requiredCorrect} but the lesson has only ${gradable} ` +
        `gradable step${gradable === 1 ? "" : "s"} (non-info)`,
    );
  }
}

// --- formula ---------------------------------------------------------------

function checkFormula(step: FormulaStep, fail: (m: string) => void) {
  if (typeof step.solution !== "string") return fail("formula step has no solution");
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

/** Parses "B2", "B2:C4", "B:B" or "3:3" into the parts it names; null if malformed. */
function parseTarget(target: string): Part[] | null {
  const pieces = target.toUpperCase().split(":");
  if (pieces.length === 1) {
    const p = parsePart(pieces[0]!);
    return p?.kind === "cell" ? [p] : null;
  }
  if (pieces.length !== 2) return null;
  const a = parsePart(pieces[0]!);
  const b = parsePart(pieces[1]!);
  return a && b && a.kind === b.kind ? [a, b] : null;
}

function checkSelect(step: SelectStep, fail: (m: string) => void) {
  const parts = typeof step.target === "string" ? parseTarget(step.target) : null;
  if (!parts) return fail(`target "${step.target}" is not a cell, range, column or row`);

  const grid: Grid = Array.isArray(step.grid) ? step.grid : [];
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((r) => (Array.isArray(r) ? r.length : 0)));
  const inside = parts.every((p) => {
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

const RESERVED_KEYS = new Set(["w", "t", "n", "q", "tab"]);
const PRIMARY_MODIFIERS = new Set(["ctrl", "control", "cmd", "command", "meta"]);

/** Ctrl/Cmd + W, T, N, Q or Tab, with or without other modifiers: the browser keeps these. */
export function isReservedCombo(combo: string): boolean {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const key = parts.at(-1) ?? "";
  return RESERVED_KEYS.has(key) && parts.slice(0, -1).some((p) => PRIMARY_MODIFIERS.has(p));
}

function checkShortcut(step: ShortcutStep, fail: (m: string) => void) {
  for (const os of ["win", "mac"] as const) {
    const keys: unknown = step.keys?.[os];
    if (keys == null) continue;
    for (const combo of Array.isArray(keys) ? keys : [keys]) {
      if (typeof combo === "string" && isReservedCombo(combo)) {
        fail(`${os} shortcut "${combo}" uses a browser-reserved combo (Ctrl/Cmd + W, T, N, Q, Tab)`);
      }
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
