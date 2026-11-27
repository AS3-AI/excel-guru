"use client";

import {
  plCardClasses,
  plActionsClasses,
  plArenaClasses,
  plBriefClasses,
  plDrawerClasses,
  plKeyClasses,
  plListDialogClasses,
  plSidebarClasses,
  plStatsClasses,
} from "./player-styles";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormulaStep, Lesson, Os } from "@excel-guru/grader";
import {
  gradeAcceptStep,
  gradeFormulaStep,
  gradeMcqStep,
  gradeSelectStep,
  gradeSequenceStep,
  gradeShortcutStep,
  LESSON_TODAY,
} from "@excel-guru/grader";
import { Sheet } from "@excel-guru/engine";
import { Grid, formatValue, rawInput } from "@/components/grid/Grid";
import { RichText } from "@/components/RichText";
import { countLessonProgress, createPlayerState, playerReducer } from "@/lib/player-state";
import { mergeLocalProgress, writeLocalProgress } from "@/lib/local-progress";
import { getPlatform } from "@/lib/platform";
import { StepView } from "./steps/StepView";
import { ShortcutStep as ShortcutPractice, shortcutSkipOutcome } from "./steps/ShortcutStep";
import { LessonList, type LessonNavItem } from "./LessonList";
import { LESSON_PROGRESS_EVENT, type LessonProgressDetail } from "./TopbarProgress";
import { answerPointsVisible } from "@/lib/leaderboard";
import { PROFILE_HREF } from "@/lib/nav-links";
import { Icon } from "@/components/icons";
import { Doodle } from "@/components/Doodles";

type Props = {
  lesson: Lesson;
  next: number[];
  nextLessonId: string | null;
  lessons: LessonNavItem[];
  signedOutIntro?: boolean;
  signedIn?: boolean;
  inviteNotice?: boolean;
};
function formulaWrongMessage(reason: string | undefined, step: FormulaStep, input: string): string {
  if (input.trim() === "")
    return `${step.targetCell} is still empty. Type your formula in ${step.targetCell}, then press Enter.`;
  if (reason === "not_formula")
    return (
      step.wrongFeedback?.notFormula ??
      "That's a value, not a formula. Formulas start with an equals sign (=)."
    );
  if (reason === "parse_error")
    return (
      step.wrongFeedback?.parseError ??
      "That formula can't be read. Check for a typo, a missing bracket or a stray symbol."
    );
  if (reason === "missing_reference")
    return (
      step.wrongFeedback?.missingReference ??
      "Use cell addresses (like B2) instead of fixed numbers so the result updates when data changes."
    );
  if (reason === "disallowed_function")
    return (
      step.wrongFeedback?.disallowedFunction ??
      "No functions needed here — combine the cell addresses directly with +."
    );
  if (reason === "wrong_value") {
    if (step.wrongFeedback?.wrongValue) return step.wrongFeedback.wrongValue;
    const sheet = new Sheet(step.grid, { today: LESSON_TODAY });
    try {
      sheet.set(step.targetCell, input);
    } catch {
      /* the grader supplied the parse reason */
    }
    return `Your formula gives ${formatValue(sheet.get(step.targetCell)) || "an empty result"}, which isn't the answer. Check which cells it uses.`;
  }
  if (reason === "missing_function")
    return (
      step.wrongFeedback?.missingFunction ??
      `Your formula needs to use ${(step.mustUse ?? []).join(", ")}.`
    );
  return `Not quite. Your answer was ${input || "blank"}.`;
}
export function Player({
  lesson,
  next: _next,
  nextLessonId,
  lessons,
  signedOutIntro = false,
  signedIn = false,
  inviteNotice = false,
}: Props) {
  const router = useRouter();
  const completionDestination = signedOutIntro
    ? "/signup?completed=intro"
    : nextLessonId
      ? `/lesson/${nextLessonId}`
      : "/";
  useEffect(() => {
    if (signedIn) void mergeLocalProgress();
  }, [signedIn]);
  const [state, dispatch] = useReducer(playerReducer, undefined, () =>
    createPlayerState(lesson.steps.length, lesson.requiredCorrect),
  );
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [formulaReady, setFormulaReady] = useState(false);
  const [stepReady, setStepReady] = useState<{ input: string } | null>(null);
  const [selectedRef, setSelectedRef] = useState("");
  // The grid reports its default A1 on mount; only a later change means the learner picked a cell.
  const [selectTouched, setSelectTouched] = useState(false);
  const [wrongText, setWrongText] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const [gridResetNonce, setGridResetNonce] = useState(0);
  const [showCorrectExplain, setShowCorrectExplain] = useState(false);
  const [completedInfoIds, setCompletedInfoIds] = useState<string[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [savedStats, setSavedStats] = useState<{ points: number; streak: number } | null>(null);
  const [saveNote, setSaveNote] = useState("");
  const [answerPoints, setAnswerPoints] = useState(0);
  const [shownPoints, setShownPoints] = useState(0);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const [platform, setPlatform] = useState<{ os: Os; touch: boolean }>({ os: "win", touch: false });
  const [mobileSkippedShortcutIds, setMobileSkippedShortcutIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [keyboardUnavailable, setKeyboardUnavailable] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("excelguru:lesson-sidebar-collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("excelguru:lesson-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };
  const saveStarted = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<Sheet | null>(null);
  const commitRef = useRef(false);
  const lastCommitCell = useRef<string | null>(null);
  const listRef = useRef<HTMLDialogElement>(null);
  const step = lesson.steps[state.index]!;
  const firstTry = useMemo(() => {
    const results = Object.values(state.firstTry);
    return results.length ? Math.round((results.filter(Boolean).length / results.length) * 100) : 0;
  }, [state.firstTry]);

  const focusAnswerControl = () => {
    (
      stageRef.current?.querySelector<HTMLElement>(".shortcut-practice") ??
      stageRef.current?.querySelector<HTMLElement>('[role="grid"]') ??
      stageRef.current?.querySelector<HTMLElement>("input, button")
    )?.focus({ preventScroll: true });
  };
  const closeWrong = () => {
    setFeedback(null);
    requestAnimationFrame(focusAnswerControl);
  };

  useEffect(() => {
    setPlatform(getPlatform());
    try {
      if (window.localStorage.getItem("excelguru:lesson-sidebar-collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore storage access errors */
    }
  }, []);
  useEffect(() => {
    if (sidebarCollapsed) {
      document.body.classList.add("has-sidebar-collapsed");
    } else {
      document.body.classList.remove("has-sidebar-collapsed");
    }
    return () => {
      document.body.classList.remove("has-sidebar-collapsed");
    };
  }, [sidebarCollapsed]);

  const lessonProgress = useMemo(
    () =>
      countLessonProgress(
        lesson.steps.length,
        completedInfoIds.length,
        state.correct,
        state.complete,
      ),
    [lesson.steps.length, completedInfoIds.length, state.correct, state.complete],
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<LessonProgressDetail>(LESSON_PROGRESS_EVENT, {
        detail: { completed: lessonProgress.completed, total: lessonProgress.total },
      }),
    );
  }, [lessonProgress.completed, lessonProgress.total]);

  useEffect(() => {
    if (!state.complete || saveStarted.current) return;
    saveStarted.current = true;
    const attempts = state.attempts.map((attempt) =>
      lesson.steps.find((item) => item.id === attempt.stepId)?.type === "shortcut"
        ? { ...attempt, os: platform.os }
        : attempt,
    );
    void (async () => {
      try {
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, attempts }),
        });
        if (response.ok) {
          const data = (await response.json()) as { points?: unknown; streak?: unknown };
          if (typeof data.points === "number" && typeof data.streak === "number")
            setSavedStats({ points: data.points, streak: data.streak });
          window.dispatchEvent(new Event("excelguru:progress-saved"));
          return;
        }
        if (response.status >= 500) {
          writeLocalProgress(lesson.id, attempts);
          setSaveNote("Progress could not sync yet; it is saved on this device.");
        } else if (response.status === 401) {
          writeLocalProgress(lesson.id, attempts);
          setSaveNote("Saved on this device. Sign in to keep your progress.");
        } else {
          setSaveNote("Progress could not be saved.");
        }
      } catch {
        writeLocalProgress(lesson.id, attempts);
        setSaveNote("Progress could not sync yet; it is saved on this device.");
      }
    })();
  }, [state.complete, state.attempts, lesson.id, lesson.steps, platform.os]);
  useEffect(() => {
    if (celebrate) {
      continueRef.current?.focus({ preventScroll: true });
      const timer = window.setTimeout(() => router.push(completionDestination), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [celebrate, completionDestination, router]);
  useEffect(() => {
    if (!celebrate && !state.complete) {
      lastCommitCell.current = null;
      setFormulaReady(false);
      setStepReady(null);
      const initial =
        stageRef.current?.querySelector<HTMLElement>(
          step.type === "shortcut" ? ".shortcut-practice" : '[role="grid"]',
        ) ?? stageRef.current?.querySelector<HTMLElement>("input, button");
      if (initial) initial.focus({ preventScroll: true });
      else continueRef.current?.focus({ preventScroll: true });
    }
  }, [state.visit, state.complete, step.type, celebrate]);
  useEffect(() => {
    if (step.type !== "shortcut" || !mobileSkippedShortcutIds.has(step.id) || state.complete)
      return;
    if (
      shortcutSkipOutcome(lesson.steps, state.index, state.correct, lesson.requiredCorrect) ===
      "keyboard-required"
    ) {
      setKeyboardUnavailable(true);
      return;
    }
    dispatch({ type: "continue" });
  }, [
    step,
    state.index,
    state.correct,
    state.complete,
    mobileSkippedShortcutIds,
    lesson.steps,
    lesson.requiredCorrect,
  ]);
  useEffect(() => {
    if (feedback === "correct") continueRef.current?.focus({ preventScroll: true });
  }, [feedback]);
  useEffect(() => {
    if (feedback === "wrong") focusAnswerControl();
  }, [feedback]);
  useEffect(() => {
    if (feedback === "wrong") {
      document.body.classList.add("has-drawer");
    } else {
      document.body.classList.remove("has-drawer");
    }
    return () => {
      document.body.classList.remove("has-drawer");
    };
  }, [feedback]);
  useEffect(() => {
    if (feedback !== "wrong") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeWrong();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback]);
  useEffect(() => {
    if (feedback === "wrong") feedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [feedback]);
  useEffect(() => {
    if (feedback !== "correct") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || answerPoints <= 0) {
      setShownPoints(answerPoints);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 420);
      setShownPoints(Math.round(answerPoints * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [feedback, answerPoints]);
  useEffect(() => {
    if (!celebrate) return;
    const total = savedStats?.points ?? 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || total <= 0) {
      setCelebrationPoints(total);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      setCelebrationPoints(Math.round(total * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [celebrate, savedStats?.points]);

  const answer = (input: string, correct: boolean, reason?: string) => {
    if (feedback === "correct" || state.complete) return;
    dispatch({ type: "answer", stepId: step.id, input, correct });
    setFeedback(correct ? "correct" : "wrong");
    if (!correct) setWrongText(reason ?? "Not quite. Try again.");
    if (correct) {
      setShowSolution(false);
      setShowCorrectExplain(false);
      const points = showSolution
        ? 0
        : Math.round(10 * lesson.difficulty * (state.firstTry[step.id] === undefined ? 1.5 : 1));
      setAnswerPoints(points);
    }
  };
  const formulaInput = (s: FormulaStep) =>
    sheetRef.current?.getFormula(s.targetCell) ??
    rawInput(sheetRef.current?.get(s.targetCell) ?? null);
  const resetSheet = () => {
    lastCommitCell.current = null;
    setFormulaReady(false);
    setGridResetNonce((n) => n + 1);
    requestAnimationFrame(() =>
      stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus(),
    );
  };
  const check = (s: FormulaStep) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && stageRef.current?.contains(active)) {
      const draft = active.value;
      commitRef.current = false;
      active.blur();
      if (!commitRef.current) {
        const wrongCell = lastCommitCell.current;
        if (wrongCell) {
          resetSheet();
          answer(
            draft,
            false,
            `You typed in ${wrongCell}, but this question asks for ${s.targetCell}. Enter your formula in ${s.targetCell}.`,
          );
          return;
        }
        const result = gradeFormulaStep(s, draft);
        if (result.reason === "parse_error") return;
        answer(
          draft,
          result.correct,
          result.correct ? undefined : formulaWrongMessage(result.reason, s, draft),
        );
        stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus();
        return;
      }
    }
    const wrongCell = lastCommitCell.current;
    if (wrongCell) {
      resetSheet();
      answer(
        "",
        false,
        `You typed in ${wrongCell}, but this question asks for ${s.targetCell}. Enter your formula in ${s.targetCell}.`,
      );
      return;
    }
    const input = formulaInput(s);
    const result = gradeFormulaStep(s, input);
    answer(
      input,
      result.correct,
      result.correct ? undefined : formulaWrongMessage(result.reason, s, input),
    );
    if (!result.correct) stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus();
  };
  const resetStepState = () => {
    setFeedback(null);
    setShowSolution(false);
    setShowCorrectExplain(false);
    setStepReady(null);
    setSelectedRef("");
    setSelectTouched(false);
  };
  const nextStep = () => {
    if (step.type === "info") {
      setCompletedInfoIds((prev) => (prev.includes(step.id) ? prev : [...prev, step.id]));
    }
    if (state.complete) {
      setCelebrate(true);
      setFeedback(null);
      setShowCorrectExplain(false);
      return;
    }
    dispatch({ type: "continue" });
    resetStepState();
  };
  const checkStep = () => {
    if (step.type === "select") {
      const ref = selectedRef;
      const ok = Boolean(ref) && gradeSelectStep(step, ref);
      answer(ref, ok, ok ? undefined : (step.wrongFeedback ?? "Not quite. Try again."));
      return;
    }
    if (step.type === "mcq" && stepReady) {
      const idx = Number(stepReady.input);
      const ok = gradeMcqStep(step, idx);
      answer(
        stepReady.input,
        ok,
        ok ? undefined : (step.wrongFeedback?.[idx] ?? "Not quite. Try again."),
      );
    }
    if ((step.type === "picture" || step.type === "project") && stepReady)
      answer(stepReady.input, gradeAcceptStep(step, stepReady.input));
  };
  const shortcutAttempt = (input: string, _componentCorrect: boolean) => {
    if (step.type !== "shortcut") return;
    const correct =
      step.mode === "chord"
        ? gradeShortcutStep(step, input, platform.os)
        : gradeSequenceStep(step, input.split(" ⟶ "), platform.os);
    answer(input, correct);
  };
  const skipShortcutStep = () => {
    dispatch({ type: "skip" });
    resetStepState();
  };
  const skipShortcutSection = () => {
    const remaining = lesson.steps.slice(state.index);
    const ids = remaining
      .filter((candidate) => candidate.type === "shortcut")
      .map((candidate) => candidate.id);
    if (
      shortcutSkipOutcome(lesson.steps, state.index, state.correct, lesson.requiredCorrect) ===
      "keyboard-required"
    ) {
      setKeyboardUnavailable(true);
      setMobileSkippedShortcutIds((current) => new Set([...current, ...ids]));
      return;
    }
    setMobileSkippedShortcutIds((current) => new Set([...current, ...ids]));
    skipShortcutStep();
  };
  const practiceReady = useCallback((node: HTMLElement | null) => {
    if (node) node.focus({ preventScroll: true });
  }, []);
  const goPrevious = () => {
    dispatch({ type: "previous" });
    resetStepState();
  };
  const skipQuestion = () => {
    dispatch({ type: "skip" });
    resetStepState();
  };
  const canGoBack = state.history.length > 0;
  useEffect(() => {
    // Left arrow = previous outside the grid, where arrows move cells; Enter = Continue.
    // Never while typing in a field, on shortcut steps, in the sidebar, or with modifiers.
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || step.type === "shortcut") return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(
          "input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable=true], .pl-lessons, nav, header",
        )
      )
        return;
      const outsideGrid = !t?.closest("[role=grid], input");
      if (e.key === "ArrowLeft" && canGoBack && outsideGrid) {
        e.preventDefault();
        goPrevious();
      }
      // Enter presses Continue wherever focus is; a focused button already handles its own Enter.
      else if (e.key === "Enter" && continueRef.current && !t?.closest("button, a")) {
        e.preventDefault();
        e.stopPropagation();
        continueRef.current.click();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });
  const onStageCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    commitRef.current = false;
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (
        e.target instanceof HTMLElement &&
        e.target.getAttribute("role") === "grid" &&
        step.type === "formula" &&
        feedback !== "correct"
      ) {
        e.preventDefault();
        e.stopPropagation();
        check(step);
      } else if (
        e.target instanceof HTMLElement &&
        e.target.getAttribute("role") === "grid" &&
        step.type === "select" &&
        feedback !== "correct"
      ) {
        e.preventDefault();
        e.stopPropagation();
        checkStep();
      } else if (e.target instanceof HTMLInputElement && step.type === "mcq" && stepReady) {
        e.preventDefault();
        checkStep();
      } else if (
        e.target instanceof HTMLInputElement &&
        (step.type === "picture" || step.type === "project") &&
        stepReady?.input.trim()
      ) {
        e.preventDefault();
        checkStep();
      }
    }
  };
  const onStageKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === "Enter" &&
      step.type === "formula" &&
      e.target instanceof HTMLInputElement &&
      commitRef.current
    ) {
      commitRef.current = false;
      const wrongCell = lastCommitCell.current;
      if (wrongCell) {
        resetSheet();
        answer(
          "",
          false,
          `You typed in ${wrongCell}, but this question asks for ${step.targetCell}. Enter your formula in ${step.targetCell}.`,
        );
        return;
      }
      const input = formulaInput(step),
        result = gradeFormulaStep(step, input);
      if (result.reason !== "parse_error")
        answer(
          input,
          result.correct,
          result.correct ? undefined : formulaWrongMessage(result.reason, step, input),
        );
    }
  };

  const hasBrief = step.type === "formula" || step.type === "select";
  const canCheck =
    (step.type === "formula" && formulaReady) ||
    (step.type === "select" && selectTouched) ||
    (step.type === "mcq" && Boolean(stepReady)) ||
    ((step.type === "picture" || step.type === "project") && Boolean(stepReady?.input.trim()));
  const primaryKeyClasses = `btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`;
  // Same rule as answer(): first try is worth 1.5×, nothing once the answer has been shown.
  const stakes = answerPointsVisible(signedIn)
    ? showSolution
      ? 0
      : Math.round(10 * lesson.difficulty * (state.firstTry[step.id] === undefined ? 1.5 : 1))
    : null;
  const firstTryRun = (() => {
    let n = 0;
    for (const ok of Object.values(state.firstTry).reverse()) {
      if (!ok) break;
      n++;
    }
    return n;
  })();
  const openList = () => listRef.current?.showModal();
  const closeList = () => listRef.current?.close();
  const sidebar = (
    <aside
      className={`pl-sidebar ${sidebarCollapsed ? "w-[56px]" : "w-[280px]"} ${plSidebarClasses}`}
      aria-label="Lessons sidebar"
    >
      {sidebarCollapsed && (
        <header className="justify-center! px-0!">
          <button
            type="button"
            aria-label="Expand lessons sidebar"
            aria-expanded={false}
            title="Expand lessons"
            onClick={toggleSidebar}
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </header>
      )}
      <LessonList
        items={lessons}
        currentId={lesson.id}
        collapsed={sidebarCollapsed}
        onCollapse={toggleSidebar}
      />
    </aside>
  );
  const hud = (
    <header className="pl-hud [@media(min-width:900px)]:hidden flex items-center gap-s3 mb-s3">
      <h1 className="sr-only">{lesson.title}</h1>
      <button
        type="button"
        className="pl-hud-btn inline-flex items-center gap-[8px] min-h-[40px] p-[8px_12px] [border:var(--line)] rounded-ledger bg-surface
          text-ink text-ledger-sm font-medium cursor-pointer
          [transition:background-color_var(--d2),_border-color_var(--d2)] [box-shadow:2px_2px_0_var(--ink)]
          [&:hover]:bg-butter
          [&:active]:[transform:translate(2px,_2px)] [&:active]:[box-shadow:none]"
        onClick={openList}
        aria-haspopup="dialog"
      >
        <Icon name="menu" size={16} />
        <span>Lessons</span>
      </button>
    </header>
  );
  const list = (
    <dialog
      ref={listRef}
      className={`pl-list-dialog ${plListDialogClasses}`}
      aria-label="All lessons"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeList();
      }}
    >
      <header>
        <strong>All lessons</strong>
        <button type="button" aria-label="Close lessons" onClick={closeList}>
          <Icon name="x" size={18} />
        </button>
      </header>
      <LessonList items={lessons} currentId={lesson.id} />
    </dialog>
  );

  if (keyboardUnavailable)
    return (
      <div className="pl-board">
        {sidebar}
        {hud}
        <main className={`pl-arena is-solo ${plArenaClasses}`} id="main">
          <section className={`pl-card ${plCardClasses}`}>
            <p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]">
              This lesson needs a keyboard — continue on a computer.
            </p>
            <Link
              className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`}
              aria-keyshortcuts="Enter"
              href={signedIn ? PROFILE_HREF : "/"}
            >
              {signedIn ? "Go to profile" : "Go home"}
            </Link>
          </section>
        </main>
        {list}
      </div>
    );
  return (
    <div className="pl-board">
      {sidebar}
      {hud}
      {celebrate ? (
        <main
          className="pl-complete relative overflow-hidden grid [justify-items:start] gap-s4 p-[var(--s7)_var(--s6)] bg-surface
          [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-pop)]
          [@media(max-width:640px)]:p-[var(--s6)_var(--s4)]
          [&_h2]:relative [&_h2]:m-0 [&_h2]:text-[clamp(2rem,_4.6vw,_3.25rem)] [&_h2]:tracking-[-0.035em]
          [&_.eyebrow]:relative [&_.eyebrow]:m-0"
          id="main"
          aria-labelledby="pl-done-title"
        >
          <div
            className="pl-complete-cells absolute top-0 right-0 grid grid-cols-[repeat(8,_44px)] [grid-auto-rows:22px] opacity-[0.9]
          [mask-image:linear-gradient(to_bottom_left,_#000_20%,_transparent_75%)]
          [&_i]:[border-left:1px_solid_var(--border)] [&_i]:[border-bottom:1px_solid_var(--border)] [&_i]:bg-primary-tint
          [&_i]:[animation:pl-fill_700ms_var(--ease)_backwards]
          [&_i:nth-child(5n)]:bg-primary
          [&_i:nth-child(7n)]:bg-highlight"
            aria-hidden="true"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 8) * 40 + Math.floor(i / 8) * 60}ms` }} />
            ))}
          </div>
          <p className="eyebrow">
            <span className="ref">✓</span>
            {lesson.module}
          </p>
          <h2 id="pl-done-title">Lesson complete!</h2>
          <Doodle
            name="trophy"
            className="pl-trophy draw w-[120px] right-s6 bottom-s6
          [@media(max-width:640px)]:w-[72px] [@media(max-width:640px)]:right-s4 [@media(max-width:640px)]:bottom-s4"
            fill="var(--highlight)"
          />
          <dl className={`pl-stats ${plStatsClasses}`}>
            <div>
              <dt>First-try accuracy</dt>
              <dd className="num">{firstTry}%</dd>
            </div>
            <div>
              <dt>Questions correct</dt>
              <dd className="num">{state.correct}</dd>
            </div>
            {savedStats && (
              <>
                <div className="is-gold">
                  <dt>Points earned</dt>
                  <dd className="num">+{celebrationPoints}</dd>
                </div>
                <div>
                  <dt>Day streak</dt>
                  <dd className="num">{savedStats.streak}</dd>
                </div>
              </>
            )}
          </dl>
          {inviteNotice && (
            <p
              className="pl-invite-note relative w-full m-[0_0_var(--s3)] p-[var(--s3)_var(--s4)] bg-mint [border:var(--line)] rounded-ledger
          text-ledger-sm text-left"
              role="note"
            >
              <strong>No payment needed.</strong> You joined with an invite code, so every lesson is
              unlocked. Keep going!
            </p>
          )}
          {saveNote && (
            <p role="status" className="pl-save-note m-0 text-muted text-ledger-sm">
              {saveNote}
            </p>
          )}
          <button
            ref={continueRef}
            className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`}
            aria-keyshortcuts="Enter"
            onClick={() => router.push(completionDestination)}
          >
            Continue <span aria-hidden="true">⏎</span>
          </button>
        </main>
      ) : (
        <main
          className={`pl-arena${hasBrief ? "" : " is-solo"} ${plArenaClasses}`}
          id="main"
          data-feedback={feedback ?? undefined}
        >
          {!hasBrief && step.type !== "info" && stakes !== null && feedback !== "correct" && (
            <p
              className="pl-solo-head [grid-column:1_/_-1] flex items-center justify-end gap-s3 m-[0_0_calc(-1_*_var(--s2))]
          [font:500_var(--fs-xs)/1_var(--mono)] text-muted
          [animation:pl-enter_var(--d3)_var(--ease)]"
              key={`head-${state.visit}`}
            >
              <span className="pl-chip-pts inline-flex items-center gap-[6px] p-[4px_9px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)] bg-highlight text-ink">
                {stakes > 0 ? `+${stakes} pts` : "No points"}
              </span>
            </p>
          )}
          <div
            ref={stageRef}
            className="pl-stage [grid-column:1_/_-1] min-w-0 py-s2 px-0
          min-h-[calc(100dvh-250px)] [@media(max-width:640px)]:min-h-[calc(100dvh-360px)]
          [@media(max-width:640px)]:py-s2
          [&_.pl-card]:[box-shadow:none]
          [&_.pl-card:last-child]:mb-0
          [&_.pl-options:last-child]:mb-0
          [&_.eg-sheet]:max-w-[none]!"
            onKeyDownCapture={onStageCapture}
            onKeyDown={onStageKey}
          >
            {hasBrief && (
              <section
                className={`pl-brief ${plBriefClasses}`}
                key={`brief-${state.visit}`}
                aria-label="Challenge"
              >
                {(stakes !== null || firstTryRun >= 2) && feedback !== "correct" && (
                  <div className="flex flex-wrap items-center gap-s2">
                    {stakes !== null && (
                      <span className="pl-chip-pts inline-flex items-center gap-[6px] p-[4px_9px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)] bg-highlight text-ink">
                        {stakes > 0 ? `+${stakes} pts` : "No points"}
                      </span>
                    )}
                    {firstTryRun >= 2 && (
                      <span className="pl-chip-run inline-flex items-center gap-[6px] p-[4px_9px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)] bg-mint text-ink [animation:pl-pop-in_var(--d3)_var(--ease)]">
                        <Icon name="sparkle" size={13} />
                        {firstTryRun} in a row
                      </span>
                    )}
                  </div>
                )}
                <div className="pl-prompt grid gap-s3 m-0 max-w-[66ch] text-ink">
                  {step.prompt.split(/\n\n+/).map((block, idx) => {
                    const lines = block.split("\n");
                    return (
                      <div key={idx} className="grid gap-[4px]">
                        {lines.map((line, lineIdx) => (
                          <p key={lineIdx} className="m-0">
                            <RichText text={line} />
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {step.keycaps && step.keycaps.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-[8px] pt-s1"
                    aria-label="Keys and actions"
                  >
                    {step.keycaps.map((label, i) => (
                      <span key={`${label}-${i}`} className="inline-flex items-center gap-[8px]">
                        <kbd className="eg-kbd">{label}</kbd>
                        {i < step.keycaps!.length - 1 && (
                          <span className="text-muted text-ledger-xs" aria-hidden="true">
                            →
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}
            <div
              className="pl-stage-in [animation:pl-enter_var(--d3)_var(--ease)]"
              key={`stage-${state.visit}`}
            >
              {step.type === "formula" ? (
                <Grid
                  key={`${step.id}-${state.visit}-${gridResetNonce}`}
                  grid={step.grid}
                  today={LESSON_TODAY}
                  targetCell={step.targetCell}
                  activeCell={step.activeCell}
                  highlightCells={step.highlightCells}
                  yellowCells={step.yellowCells}
                  sheetRef={sheetRef}
                  disableSheetActions={feedback === "correct"}
                  onEditStart={() => {
                    setFormulaReady(true);
                    setFeedback((f) => (f === "wrong" && !showSolution ? null : f));
                  }}
                  onCommit={(addr, input) => {
                    commitRef.current = true;
                    lastCommitCell.current =
                      addr !== step.targetCell && input.trim() !== "" ? addr : null;
                    setFeedback((f) => (f === "wrong" && !showSolution ? null : f));
                  }}
                  onHistoryChange={(edits) => {
                    const last = edits[edits.length - 1];
                    lastCommitCell.current =
                      last && last.addr !== step.targetCell && last.input.trim() !== ""
                        ? last.addr
                        : null;
                    setFormulaReady(edits.length > 0);
                    setFeedback((f) => (f === "wrong" && !showSolution ? null : f));
                  }}
                />
              ) : step.type === "shortcut" ? (
                <ShortcutPractice
                  key={`${step.id}-${state.visit}`}
                  step={step}
                  os={platform.os}
                  touch={platform.touch}
                  showPostcondition={feedback === "correct"}
                  onAttempt={shortcutAttempt}
                  onSkip={skipShortcutStep}
                  onSkipSection={skipShortcutSection}
                  onPracticeReady={practiceReady}
                />
              ) : (
                <StepView
                  key={`${step.id}-${state.visit}`}
                  step={step}
                  setSelectRef={(ref) => {
                    if (selectedRef) setSelectTouched(true);
                    setSelectedRef(ref);
                    setFeedback((f) => (f === "wrong" && !showSolution ? null : f));
                  }}
                  onReady={(input) => setStepReady({ input })}
                  onEditStart={() =>
                    setFeedback((f) => (f === "wrong" && !showSolution ? null : f))
                  }
                />
              )}
            </div>
          </div>
          <div
            className={`pl-actions${feedback === "correct" ? " is-correct" : ""} ${plActionsClasses}`}
          >
            {feedback === "correct" ? (
              <>
                <strong className="pl-correct-label inline-flex items-center gap-[10px] [color:#fff] [font:650_1.15rem_var(--font-display)]">
                  <span
                    className="pl-correct-icon grid place-items-center w-[28px] h-[28px] rounded-[50%] bg-primary [color:#fff]
          [animation:pl-pop_420ms_var(--ease)] [border:2px_solid_var(--ink)]"
                    aria-hidden="true"
                  >
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                  Correct!
                </strong>
                {answerPointsVisible(signedIn) && (
                  <span
                    className="pl-points-earned p-[3px_9px] rounded-[4px] bg-highlight text-ink! [font:700_var(--fs-sm)_var(--mono)] tabular-nums
          [animation:pl-float_600ms_var(--ease)]"
                    aria-live="polite"
                  >
                    +{shownPoints} pts
                  </span>
                )}
                {(step.type === "formula" || step.type === "mcq") && step.explain ? (
                  <button
                    type="button"
                    className={`btn pl-key ${plKeyClasses}`}
                    aria-expanded={showCorrectExplain}
                    onClick={() => setShowCorrectExplain((open) => !open)}
                  >
                    {showCorrectExplain ? "Hide explanation" : "View explanation"}
                  </button>
                ) : null}
                <button
                  ref={continueRef}
                  className={primaryKeyClasses}
                  aria-keyshortcuts="Enter"
                  onClick={nextStep}
                >
                  Continue <span aria-hidden="true">⏎</span>
                </button>
              </>
            ) : (
              <>
                <span
                  className="pl-actions-end ml-auto flex gap-s2
          [@media(max-width:640px)]:[flex:1]"
                >
                  {step.type === "info" ? (
                    <button
                      ref={continueRef}
                      className={primaryKeyClasses}
                      aria-keyshortcuts="Enter"
                      onClick={nextStep}
                    >
                      Continue <span aria-hidden="true">⏎</span>
                    </button>
                  ) : step.type !== "shortcut" ? (
                    <button
                      disabled={!canCheck}
                      className={`${primaryKeyClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
                      aria-keyshortcuts="Enter"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => (step.type === "formula" ? check(step) : checkStep())}
                    >
                      Check <span aria-hidden="true">⏎</span>
                    </button>
                  ) : null}
                </span>
              </>
            )}
          </div>
          <div
            ref={feedbackRef}
            className="pl-feedback min-h-0 mt-s2 [grid-column:1_/_-1]
          [&:empty]:hidden"
            aria-live="polite"
          >
            {feedback === "wrong" && (
              <p
                className="pl-wrong-summary m-0 p-[10px_14px] rounded-ledger bg-rose text-ink [border:var(--line)]
          [animation:pl-enter_var(--d2)_var(--ease)]"
              >
                <RichText text={wrongText} />
              </p>
            )}
            {feedback === "correct" &&
              showCorrectExplain &&
              (step.type === "formula" || step.type === "mcq") &&
              step.explain && (
                <p
                  className="pl-explain m-0 p-[var(--s3)_var(--s4)] rounded-ledger bg-surface-sunk text-text [border:1px_solid_var(--border)] [overflow-wrap:anywhere]
          [animation:pl-enter_var(--d2)_var(--ease)]"
                >
                  <RichText text={step.explain} />
                </p>
              )}
          </div>
          {feedback === "wrong" && (
            <aside
              className={`pl-drawer ${plDrawerClasses}`}
              aria-label="Incorrect answer"
              aria-live="polite"
            >
              <header>
                <strong>Incorrect</strong>
                <button aria-label="Close" onClick={closeWrong}>
                  <Icon name="x" size={18} />
                </button>
              </header>
              {step.clues && step.clues.length > 0 && (
                <div className="mb-s4 grid gap-s2">
                  {step.clues.slice(0, Math.max(1, state.wrongCount)).map((clue, i) => (
                    <p
                      key={i}
                      className="m-0 p-[10px_12px] rounded-ledger bg-butter text-ink [border:var(--line)] text-ledger-sm leading-[1.5]"
                    >
                      <strong>Clue {i + 1}: </strong>
                      <RichText text={clue} />
                    </p>
                  ))}
                </div>
              )}
              {state.wrongCount < (step.revealAfter ?? 1) && !showSolution && (
                <p className="m-[0_0_var(--s4)] text-ledger-sm text-muted">
                  Use the clue above and try once more — the full answer unlocks after another try.
                </p>
              )}
              <div className="flex flex-wrap gap-s2 mb-s4">
                {state.wrongCount >= (step.revealAfter ?? 1) && !showSolution && (
                  <button
                    type="button"
                    className={`btn pl-key ${plKeyClasses}`}
                    onClick={() => {
                      dispatch({ type: "show-answer" });
                      setShowSolution(true);
                      focusAnswerControl();
                    }}
                  >
                    View explanation
                  </button>
                )}
                <button
                  type="button"
                  className={showSolution ? primaryKeyClasses : `btn pl-key ${plKeyClasses}`}
                  onClick={skipQuestion}
                >
                  {showSolution ? "Next question →" : "Skip explanation →"}
                </button>
              </div>
              {showSolution && (
                <>
                  <p className="pl-solution p-[var(--s3)_var(--s4)] rounded-ledger bg-surface-sunk text-text [overflow-wrap:anywhere]">
                    {step.type === "formula" ? (
                      <code className="chip">{step.solution}</code>
                    ) : step.type === "select" ? (
                      step.target
                    ) : step.type === "mcq" ? (
                      <RichText text={step.options[step.answer]!} />
                    ) : step.type === "picture" || step.type === "project" ? (
                      step.accept[0]
                    ) : step.type === "shortcut" ? (
                      step.mode === "sequence" ? (
                        (step.keys[platform.os]?.join(" → ") ?? "Unavailable on Mac")
                      ) : (
                        (step.keys[platform.os] ?? "Unavailable on Mac")
                      )
                    ) : (
                      ""
                    )}
                  </p>
                  {(step.type === "formula" || step.type === "mcq") && step.explain && (
                    <p className="pl-solution-explain m-0 p-[var(--s3)_var(--s4)] rounded-ledger bg-surface-warm [border:1px_solid_var(--border)] text-text leading-[1.6] [overflow-wrap:anywhere]">
                      <RichText text={step.explain} />
                    </p>
                  )}
                </>
              )}
            </aside>
          )}
        </main>
      )}
      {list}
    </div>
  );
}
