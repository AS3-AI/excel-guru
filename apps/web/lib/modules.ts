export type ModuleDefinition = { slug: string; title: string; order: number; total: number };
export const MODULES: readonly ModuleDefinition[] = [
  { slug: "sum", title: "SUM", order: 1, total: 9 },
  { slug: "count", title: "COUNT", order: 2, total: 7 },
  { slug: "logical", title: "Logical", order: 3, total: 7 },
  { slug: "lookup", title: "Lookup", order: 4, total: 10 },
  { slug: "text-search", title: "Text Search", order: 5, total: 7 },
  { slug: "intro-to-shortcuts", title: "Intro to Shortcuts", order: 6, total: 6 },
  { slug: "cell-selection", title: "Cell Selection", order: 7, total: 7 },
  { slug: "text-manipulation", title: "Text Manipulation", order: 8, total: 4 },
  { slug: "index-match", title: "Index Match", order: 9, total: 6 },
  { slug: "statistical", title: "Statistical", order: 10, total: 7 },
  { slug: "tables", title: "Tables", order: 11, total: 4 },
  { slug: "dates", title: "Dates", order: 12, total: 5 },
  { slug: "other-skills", title: "Other Skills", order: 13, total: 2 },
  { slug: "array-formulas", title: "Array Formulas", order: 14, total: 2 },
  { slug: "combined", title: "Combined", order: 15, total: 2 },
];
export type ModuleLesson = { id: string; module: string };
export type ModuleProgress = ModuleDefinition & { done: number; lessons: ModuleLesson[] };
export function getModuleProgress(input: { lessons: readonly ModuleLesson[]; completedIds: readonly string[] }): ModuleProgress[] {
  const completed = new Set(input.completedIds);
  return MODULES.map((module) => {
    const lessons = input.lessons.filter((lesson) => lesson.module === module.slug);
    return { ...module, lessons, done: lessons.filter((lesson) => completed.has(lesson.id)).length };
  });
}
export function nextRecommendedPath(order: readonly string[], completedIds: readonly string[]): string {
  const completed = new Set(completedIds);
  const next = order.find((id) => !completed.has(id));
  return next ? `/lesson/${next}` : "/review";
}
export type StatusTag = "low" | "practice" | "good";
export function statusCounts(tags: readonly StatusTag[]): Record<StatusTag, number> {
  return tags.reduce((counts, tag) => { counts[tag]++; return counts; }, { low: 0, practice: 0, good: 0 });
}
