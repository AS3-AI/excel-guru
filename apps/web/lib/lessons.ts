// Lesson content (content/lessons/<module>/<id>.json and content/order.json), read from disk on the
// server at build time. Server only: node:fs is imported here, so client components import types
// from @excel-guru/grader and take anything they need (e.g. stepSequence) as props.
// Shape checks live in `pnpm validate-content`; this file trusts what it guarantees.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Lesson } from "@excel-guru/grader";

/** Decision 19: when a lesson runs out of steps, play continues from step 4 (index 3). */
export const CYCLE_FROM = 3;

// Same shape validate-content accepts for a file name; also keeps ids from walking the filesystem.
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** The step after `index` in a lesson of `count` steps, cycling from step 4 (or step 1 if shorter). */
export function nextStepIndex(index: number, count: number): number {
  if (index + 1 < count) return index + 1;
  return count > CYCLE_FROM ? CYCLE_FROM : 0;
}

/** nextStepIndex for every step: table[i] is the step after i. Serializable, so the player takes it as a prop. */
export function stepSequence(count: number): number[] {
  return Array.from({ length: count }, (_, i) => nextStepIndex(i, count));
}

/** The lesson after `id` in `order`, or null at the end or for an id not in it. */
export function nextInOrder(order: readonly string[], id: string): string | null {
  const i = order.indexOf(id);
  return i === -1 ? null : (order[i + 1] ?? null);
}

/** content/ in the repo root, found by walking up from the working directory (apps/web or the root). */
function contentDir(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, "content");
    if (existsSync(join(candidate, "order.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`content/order.json not found above ${process.cwd()}`);
    dir = parent;
  }
}

/** Lesson ids in recommended order (content/order.json). */
export function getOrder(): string[] {
  return JSON.parse(readFileSync(join(contentDir(), "order.json"), "utf8")) as string[];
}

/** The lesson at content/lessons/<module>/<id>.json, or null if there is none. */
export function getLesson(id: string): Lesson | null {
  if (!ID_RE.test(id)) return null;
  const lessonsDir = join(contentDir(), "lessons");
  for (const module of readdirSync(lessonsDir)) {
    const file = join(lessonsDir, module, `${id}.json`);
    if (existsSync(file) && statSync(file).isFile()) {
      return JSON.parse(readFileSync(file, "utf8")) as Lesson;
    }
  }
  return null;
}

/** The next lesson in recommended order, or null after the last one. */
export function nextLessonId(id: string): string | null {
  return nextInOrder(getOrder(), id);
}

export type SyllabusTopic = { n: number; title: string; lesson: string | null; covers: string[] };
export type SyllabusLevel = { title: string; topics: SyllabusTopic[] };

/** The full course index (content/syllabus.json); topics with `lesson: null` aren't written yet. */
export function getSyllabus(): SyllabusLevel[] {
  return (
    JSON.parse(readFileSync(join(contentDir(), "syllabus.json"), "utf8")) as {
      levels: SyllabusLevel[];
    }
  ).levels;
}
