import {
  gradeAcceptStep,
  gradeFormulaStep,
  gradeMcqStep,
  gradeSelectStep,
  gradeSequenceStep,
  gradeShortcutStep,
  type Lesson,
  type Step,
} from "@excel-guru/grader";
import { nextLessonId } from "./lessons";
import { getIstDate, getIstDayUtcBounds } from "./dates";

export { getIstDate, getIstDayUtcBounds };

export type ProgressAttempt = {
  stepId: string;
  input: string;
  showedAnswer: boolean;
  os?: "win" | "mac";
  correct?: boolean;
};
export type StreakRow = { current: number; longest: number; last_active_date: string | null };
export type ScoredProgress = {
  points: number;
  firstTryAccuracy: number;
  correctCount: number;
  nextLessonId: string | null;
};
export type EarlierLessonCompletion = { completed_at: string | Date; points: number };

/** Only a duplicate points-per-day row is recoverable by retrying at zero points. */
export function shouldRetryCompletionWithZeroPoints(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** A lesson earns points once per IST calendar day. */
export function pointsAllowedForCompletion(
  earlierCompletions: readonly EarlierLessonCompletion[],
  now: Date,
): boolean {
  const today = getIstDate(now);
  return !earlierCompletions.some(
    (completion) =>
      completion.points > 0 && getIstDate(new Date(completion.completed_at)) === today,
  );
}

/** Keeps request parsing behind the route's completed session check. */
export async function readBodyAfterAuthentication<T>(
  user: unknown,
  readBody: () => Promise<T>,
): Promise<{ authenticated: false } | { authenticated: true; body: T }> {
  if (!user) return { authenticated: false };
  return { authenticated: true, body: await readBody() };
}

function grade(step: Step, input: string, os: "win" | "mac"): boolean {
  switch (step.type) {
    case "formula":
      return gradeFormulaStep(step, input).correct;
    case "select":
      return gradeSelectStep(step, input);
    case "mcq":
      return /^\d+$/.test(input) && gradeMcqStep(step, Number(input));
    case "picture":
    case "project":
      return gradeAcceptStep(step, input);
    case "shortcut": {
      if (step.mode === "sequence") return gradeSequenceStep(step, input.split(" ⟶ "), os);
      return gradeShortcutStep(step, input, os);
    }
    case "info":
      return false;
  }
}

export function calculateProgress(
  lesson: Lesson,
  attempts: readonly ProgressAttempt[],
): ScoredProgress {
  if (attempts.length > Math.max(200, 25 * lesson.steps.length))
    throw new Error("Too many attempts");
  const steps = new Map(lesson.steps.map((step) => [step.id, step]));
  const firstByStep = new Map<string, boolean>();
  const firstCorrect = new Set<string>();
  let points = 0;
  let correctCount = 0;
  let lastIndex = -1;
  let cycle = 0;
  const counted = new Set<string>();
  const pointsAwarded = new Set<string>();
  const shownAnswerOccurrences = new Set<string>();
  for (const attempt of attempts) {
    if (
      !attempt ||
      typeof attempt.stepId !== "string" ||
      typeof attempt.input !== "string" ||
      typeof attempt.showedAnswer !== "boolean" ||
      (attempt.os !== undefined && attempt.os !== "win" && attempt.os !== "mac")
    )
      throw new Error("Invalid attempt or OS");
    const step = steps.get(attempt.stepId);
    if (!step) throw new Error("Unknown step id");
    if (step.type === "info") throw new Error("Info steps cannot be attempted");
    const index = lesson.steps.indexOf(step);
    if (lastIndex >= 0 && index < lastIndex) cycle++;
    lastIndex = index;
    const occurrence = `${cycle}:${step.id}`;
    if (attempt.showedAnswer) shownAnswerOccurrences.add(occurrence);
    const correct = grade(step, attempt.input, attempt.os ?? "win");
    if (!firstByStep.has(step.id)) {
      firstByStep.set(step.id, correct);
      if (correct) firstCorrect.add(step.id);
    }
    if (correct) {
      if (!counted.has(occurrence)) {
        counted.add(occurrence);
        correctCount++;
      }
      if (!shownAnswerOccurrences.has(occurrence) && !pointsAwarded.has(occurrence)) {
        pointsAwarded.add(occurrence);
        points +=
          10 *
          lesson.difficulty *
          (firstByStep.get(step.id) && attempts.find((a) => a.stepId === step.id) === attempt
            ? 1.5
            : 1);
      }
    }
  }
  const gradableAttempted = new Set(attempts.map((a) => a.stepId)).size;
  const firstTryAccuracy = gradableAttempted === 0 ? 0 : firstCorrect.size / gradableAttempted;
  if (correctCount < lesson.requiredCorrect) throw new Error("Lesson is not complete");
  return {
    points: Math.round(points),
    firstTryAccuracy,
    correctCount,
    nextLessonId: nextLessonId(lesson.id),
  };
}

export function getStreak(previous: StreakRow | null, now: Date): StreakRow {
  const today = getIstDate(now);
  const yesterdayDate = new Date(`${today}T00:00:00+05:30`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = getIstDate(yesterdayDate);
  const current =
    previous?.last_active_date === today
      ? previous.current
      : previous?.last_active_date === yesterday
        ? previous.current + 1
        : 1;
  return { current, longest: Math.max(previous?.longest ?? 0, current), last_active_date: today };
}

export function getStatusTag(
  firstTryAccuracy: number,
  completedAt: Date,
  now: Date,
): "low" | "practice" | "good" {
  if (firstTryAccuracy < 0.5) return "low";
  return now.getTime() - completedAt.getTime() >= 14 * 24 * 60 * 60 * 1000 ? "practice" : "good";
}

export function progressAttemptRows(
  userId: string,
  lessonId: string,
  attempts: readonly ProgressAttempt[],
  lesson: Lesson,
  now: Date,
) {
  const first = new Set<string>();
  return attempts.map((attempt) => {
    const step = lesson.steps.find((item) => item.id === attempt.stepId)!;
    const correct = grade(step, attempt.input, attempt.os ?? "win");
    const first_try = !first.has(step.id);
    first.add(step.id);
    return {
      user_id: userId,
      lesson_id: lessonId,
      step_id: step.id,
      correct,
      first_try,
      showed_answer: attempt.showedAnswer,
      started_at: null,
      ended_at: now.toISOString(),
    };
  });
}
