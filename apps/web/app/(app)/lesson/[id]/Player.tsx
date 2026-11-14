"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { Sheet } from "@excel-guru/engine";
import { gradeFormulaStep, type FormulaStep, type GradeResult, type Lesson } from "@excel-guru/grader";
import { Grid, formatValue, rawInput } from "@/components/grid/Grid";
import "./player.css";

type Props = {
  lesson: Lesson;
  /** next[i] is the step after step i, cycling from step 4 (lib/lessons.ts stepSequence). */
  next: number[];
  nextLessonId: string | null;
};

type Feedback = { correct: true } | { correct: false; message: string } | null;

/** A wrong answer's reason in the learner's words. `input` is what the target cell holds. */
function wrongMessage(step: FormulaStep, reason: GradeResult["reason"], input: string): string {
  const cell = step.targetCell;
  if (input.trim() === "") return `${cell} is still empty. Type your formula in ${cell}, then press Enter.`;
  switch (reason) {
    case "not_formula":
      return "That's a value, not a formula. Formulas start with an equals sign (=).";
    case "parse_error":
      return "That formula can't be read. Check for a typo, a missing bracket or a stray symbol.";
    case "wrong_value": {
      // Recompute on the lesson's own data, as the grader does, so edits elsewhere don't confuse the message.
      const sheet = new Sheet(step.grid);
      sheet.set(cell, input);
      return `Your formula gives ${formatValue(sheet.get(cell)) || "an empty result"}, which isn't the answer. Check which cells it uses.`;
    }
    case "missing_function":
      return `Right answer, but this step asks you to use ${(step.mustUse ?? []).join(", ")}.`;
    default:
      return "That isn't quite it. Have another go.";
  }
}

export function Player({ lesson, next, nextLessonId }: Props) {
  const [index, setIndex] = useState(0);
  /** Counts every step shown, so a revisited step (cycling) gets a fresh Grid. */
  const [visit, setVisit] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [done, setDone] = useState(false);

  const sheetRef = useRef<Sheet | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLAnchorElement>(null);
  // Set by Grid's onCommit; lets Enter and Check tell a committed edit from a dropped one.
  const committed = useRef(false);

  const step = lesson.steps[index]!;
  const required = lesson.requiredCorrect;
  const pct = Math.min(100, Math.round((correct / required) * 100));

  const focusGrid = () =>
    stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus({ preventScroll: true });

  // Every new step takes focus: the grid on a formula step, otherwise Continue.
  useEffect(() => {
    if (done) doneRef.current?.focus({ preventScroll: true });
    else if (step.type === "formula") focusGrid();
    else continueRef.current?.focus({ preventScroll: true });
  }, [visit, done, step.type]);

  // After a correct answer, Enter continues.
  useEffect(() => {
    if (feedback?.correct) continueRef.current?.focus({ preventScroll: true });
  }, [feedback]);

  /** A wrong-answer message is stale once the learner edits again; "Correct!" stays until Continue. */
  const clearWrong = () => setFeedback((f) => (f?.correct === false ? null : f));

  const grade = (s: FormulaStep, input: string) => {
    if (feedback?.correct) return; // already answered: Continue is next
    const result = gradeFormulaStep(s, input);
    if (result.correct) {
      setFeedback({ correct: true });
      setCorrect((c) => c + 1);
    } else {
      setFeedback({ correct: false, message: wrongMessage(s, result.reason, input) });
      focusGrid();
    }
  };

  /** Grades what the target cell holds in the learner's sheet. */
  const gradeCommitted = (s: FormulaStep) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    grade(s, sheet.getFormula(s.targetCell) ?? rawInput(sheet.get(s.targetCell)));
  };

  /**
   * Check: first commit any open edit (Grid commits on blur), then grade the committed cell.
   * If Grid dropped the draft because it doesn't parse, say so rather than grading the old value.
   */
  const check = (s: FormulaStep) => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && stageRef.current?.contains(el)) {
      const draft = el.value;
      committed.current = false;
      el.blur();
      if (!committed.current && gradeFormulaStep(s, draft).reason === "parse_error") {
        grade(s, draft);
        return;
      }
    }
    gradeCommitted(s);
  };

  /**
   * Capture phase, before Grid sees the key. Enter on the grid itself (no editor open) checks the
   * committed answer instead of moving the selection down. Enter inside an editor is left to Grid,
   * which commits it; onStageKeyDown then grades it.
   */
  const onStageKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    committed.current = false;
    const plainEnter = e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    const onGrid = e.target instanceof HTMLElement && e.target.getAttribute("role") === "grid";
    if (plainEnter && onGrid && step.type === "formula" && !feedback?.correct) {
      e.preventDefault();
      e.stopPropagation();
      gradeCommitted(step);
    }
  };

  // Enter in an editor: Grid's handler commits first; grade only if that commit succeeded.
  const onStageKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && committed.current && step.type === "formula") gradeCommitted(step);
  };

  const onContinue = () => {
    if (correct >= required) {
      setDone(true);
      return;
    }
    setIndex((i) => next[i] ?? 0);
    setVisit((v) => v + 1);
    setFeedback(null);
  };

  const continueButton = (
    <div className="pl-actions">
      <button ref={continueRef} type="button" className="btn pl-continue" onClick={onContinue}>
        Continue →
      </button>
      <span className="pl-hint">or press Enter</span>
    </div>
  );

  return (
    <main className="pl">
      <h1 className="pl-title">{lesson.title}</h1>
      <div className="pl-progress">
        <span className="pl-pct">{pct}%</span>
        <div
          className="pl-bar"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="pl-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {done ? (
        <section className="pl-card pl-complete">
          <h2>Lesson complete</h2>
          <p>
            You answered {correct} {correct === 1 ? "question" : "questions"} correctly.
          </p>
          {nextLessonId ? (
            <Link ref={doneRef} className="btn pl-continue" href={`/lesson/${nextLessonId}`}>
              Next lesson →
            </Link>
          ) : (
            <Link ref={doneRef} className="btn pl-continue" href="/">
              Back to home
            </Link>
          )}
        </section>
      ) : step.type === "info" ? (
        <>
          <section className="pl-card">
            <p className="pl-prompt">{step.text}</p>
          </section>
          {continueButton}
        </>
      ) : step.type === "formula" ? (
        <>
          <section className="pl-card">
            <p className="pl-prompt">{step.prompt}</p>
          </section>
          <div
            ref={stageRef}
            className="pl-stage"
            onKeyDownCapture={onStageKeyDownCapture}
            onKeyDown={onStageKeyDown}
          >
            {/* Keyed per visit: Grid compares grids by value, so a repeated step would keep the old sheet. */}
            <Grid
              key={`${step.id}-${visit}`}
              grid={step.grid}
              targetCell={step.targetCell}
              highlightCells={step.highlightCells}
              onCommit={() => {
                committed.current = true;
                // Check and Enter grade right after this commit; their result replaces the cleared one.
                clearWrong();
              }}
              onEditStart={clearWrong}
              sheetRef={sheetRef}
            />
          </div>
          {/* The actions row sits directly under the grid and feedback goes below it, so Check (and
              Continue in its place) never moves when a message appears or clears. */}
          {feedback?.correct ? (
            continueButton
          ) : (
            <div className="pl-actions">
              <button
                type="button"
                className="btn"
                // Keep focus in an open editor until check() has read the draft and committed it.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => check(step)}
              >
                Check Answer
              </button>
              <span className="pl-hint">or press Enter</span>
            </div>
          )}
          <div className="pl-feedback" aria-live="polite">
            {feedback?.correct === true && (
              <div className="pl-result is-correct">
                <p className="pl-result-head">Correct!</p>
                {step.explain && <p>{step.explain}</p>}
              </div>
            )}
            {feedback?.correct === false && (
              <div className="pl-result is-wrong">
                <p className="pl-result-head">Not quite</p>
                <p>{feedback.message}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <section className="pl-card">
            <p className="pl-prompt">{step.prompt}</p>
            <p className="pl-soon">Coming soon: this kind of question isn&apos;t playable yet.</p>
          </section>
          {continueButton}
        </>
      )}
    </main>
  );
}
