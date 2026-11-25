"use client";

import {
  plCardClasses,
  plActionsClasses,
  plArenaClasses,
  plBriefClasses,
  plDrawerClasses,
  plKeyClasses,
  plListDialogClasses,
  plStatsClasses,
  plTileBoardClasses,
  plTileStatClasses,
} from "./player-styles";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormulaStep, Lesson, Os } from "@excel-guru/grader";
import { gradeAcceptStep, gradeFormulaStep, gradeMcqStep, gradeSelectStep, gradeSequenceStep, gradeShortcutStep, LESSON_TODAY } from "@excel-guru/grader";
import { Sheet } from "@excel-guru/engine";
import { Grid, formatValue, rawInput } from "@/components/grid/Grid";
import { RichText } from "@/components/RichText";
import { createPlayerState, playerReducer } from "@/lib/player-state";
import { mergeLocalProgress, writeLocalProgress } from "@/lib/local-progress";
import { getPlatform } from "@/lib/platform";
import { StepView } from "./steps/StepView";
import { ShortcutStep as ShortcutPractice, shortcutSkipOutcome } from "./steps/ShortcutStep";
import { LessonList, type LessonNavItem } from "./LessonList";
import { Leaderboards } from "@/components/Leaderboards";
import { ShareBonus } from "@/components/ShareBonus";
import { VideoModal } from "@/components/VideoModal";
import { answerPointsVisible, celebrationStats } from "@/lib/leaderboard";
import { DASHBOARD_HREF } from "@/lib/nav-links";
import { Icon } from "@/components/icons";
import { Doodle } from "@/components/Doodles";

type Props = { lesson: Lesson; next: number[]; nextLessonId: string | null; lessons: LessonNavItem[]; signedOutIntro?: boolean; signedIn?: boolean; inviteNotice?: boolean };
// Only formula, select and shortcut mistakes get an AI explanation; a value without "=" already has a fixed message.
function explainable(step: Lesson["steps"][number], input: string): boolean {
  if (step.type === "formula") return gradeFormulaStep(step, input).reason !== "not_formula";
  return step.type === "select" || step.type === "shortcut";
}

function formulaWrongMessage(reason: string | undefined, step: FormulaStep, input: string): string {
  if (input.trim() === "") return `${step.targetCell} is still empty. Type your formula in ${step.targetCell}, then press Enter.`;
  if (reason === "not_formula") return "That's a value, not a formula. Formulas start with an equals sign (=).";
  if (reason === "parse_error") return "That formula can't be read. Check for a typo, a missing bracket or a stray symbol.";
  if (reason === "wrong_value") {
    const sheet = new Sheet(step.grid, { today: LESSON_TODAY });
    try { sheet.set(step.targetCell, input); } catch { /* the grader supplied the parse reason */ }
    return `Your formula gives ${formatValue(sheet.get(step.targetCell)) || "an empty result"}, which isn't the answer. Check which cells it uses.`;
  }
  if (reason === "missing_function") return `Your formula needs to use ${(step.mustUse ?? []).join(", ")}.`;
  return `Not quite. Your answer was ${input || "blank"}.`;
}
export function Player({ lesson, next: _next, nextLessonId, lessons, signedOutIntro = false, signedIn = false, inviteNotice = false }: Props) {
  const router = useRouter();
  const completionDestination = signedOutIntro ? "/signup?completed=intro" : nextLessonId ? `/lesson/${nextLessonId}` : "/";
  const [boardsReady, setBoardsReady] = useState(!signedIn);
  useEffect(() => { if (signedIn) void mergeLocalProgress().finally(() => setBoardsReady(true)); }, [signedIn]);
  const [state, dispatch] = useReducer(playerReducer, undefined, () => createPlayerState(lesson.steps.length, lesson.requiredCorrect));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [formulaReady, setFormulaReady] = useState(false);
  const [stepReady, setStepReady] = useState<{ input: string } | null>(null);
  const [selectedRef, setSelectedRef] = useState("");
  // The grid reports its default A1 on mount; only a later change means the learner picked a cell.
  const [selectTouched, setSelectTouched] = useState(false);
  const [wrongText, setWrongText] = useState("");
  const [aiExplanation, setAiExplanation] = useState<{ id: string; text: string; cached: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiShown, setAiShown] = useState(false);
  const [aiThanks, setAiThanks] = useState(false);
  const [aiRated, setAiRated] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [savedStats, setSavedStats] = useState<{ points: number; streak: number } | null>(null);
  const [saveNote, setSaveNote] = useState("");
  const [answerPoints, setAnswerPoints] = useState(0);
  const [shownPoints, setShownPoints] = useState(0);
  const [celebrationPoints, setCelebrationPoints] = useState(0);
  const [platform, setPlatform] = useState<{ os: Os; touch: boolean }>({ os: "win", touch: false });
  const [mobileSkippedShortcutIds, setMobileSkippedShortcutIds] = useState<Set<string>>(() => new Set());
  const [keyboardUnavailable, setKeyboardUnavailable] = useState(false);
  const saveStarted = useRef(false);
  const explainRequest = useRef<{ id: number; controller: AbortController } | null>(null);
  const explainRequestId = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<Sheet | null>(null);
  const commitRef = useRef(false);
  const listRef = useRef<HTMLDialogElement>(null);
  const step = lesson.steps[state.index]!;
  const pct = Math.min(100, Math.round(state.correct / lesson.requiredCorrect * 100));
  const savedCelebrationStats = celebrationStats(savedStats);
  const firstTry = useMemo(() => {
    const results = Object.values(state.firstTry);
    return results.length ? Math.round(results.filter(Boolean).length / results.length * 100) : 0;
  }, [state.firstTry]);

  const focusAnswerControl = () => {
    (stageRef.current?.querySelector<HTMLElement>(".shortcut-practice") ?? stageRef.current?.querySelector<HTMLElement>('[role="grid"]') ?? stageRef.current?.querySelector<HTMLElement>('input, button'))?.focus({ preventScroll: true });
  };
  const invalidateExplain = () => { const current = explainRequest.current; if (current) { current.controller.abort(); explainRequest.current = null; } };
  const closeWrong = () => { invalidateExplain(); setAiLoading(false); setFeedback(null); requestAnimationFrame(focusAnswerControl); };
  useEffect(() => () => { invalidateExplain(); }, []);

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);
  useEffect(() => {
    if (!state.complete || saveStarted.current) return;
    saveStarted.current = true;
    const attempts = state.attempts.map((attempt) => lesson.steps.find((item) => item.id === attempt.stepId)?.type === "shortcut" ? { ...attempt, os: platform.os } : attempt);
    void (async () => {
      try {
        const response = await fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: lesson.id, attempts }) });
        if (response.ok) {
          const data = await response.json() as { points?: unknown; streak?: unknown };
          if (typeof data.points === "number" && typeof data.streak === "number") setSavedStats({ points: data.points, streak: data.streak });
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
      setFormulaReady(false);
      setStepReady(null);
      const initial = stageRef.current?.querySelector<HTMLElement>(step.type === "shortcut" ? ".shortcut-practice" : '[role="grid"]') ?? stageRef.current?.querySelector<HTMLElement>('input, button');
      if (initial) initial.focus({ preventScroll: true });
      else continueRef.current?.focus({ preventScroll: true });
    }
  }, [state.visit, state.complete, step.type, celebrate]);
  useEffect(() => {
    if (step.type !== "shortcut" || !mobileSkippedShortcutIds.has(step.id) || state.complete) return;
    if (shortcutSkipOutcome(lesson.steps, state.index, state.correct, lesson.requiredCorrect) === "keyboard-required") {
      setKeyboardUnavailable(true);
      return;
    }
    dispatch({ type: "continue" });
  }, [step, state.index, state.correct, state.complete, mobileSkippedShortcutIds, lesson.steps, lesson.requiredCorrect]);
  useEffect(() => { if (feedback === "correct") continueRef.current?.focus({ preventScroll: true }); }, [feedback]);
  useEffect(() => { if (feedback === "wrong") focusAnswerControl(); }, [feedback]);
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
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeWrong(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback]);
  useEffect(() => { if (feedback === "wrong") feedbackRef.current?.scrollIntoView({ block: "nearest" }); }, [feedback]);
  useEffect(() => {
    if (feedback !== "correct") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || answerPoints <= 0) { setShownPoints(answerPoints); return; }
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || total <= 0) { setCelebrationPoints(total); return; }
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
    invalidateExplain();
    dispatch({ type: "answer", stepId: step.id, input, correct });
    setFeedback(correct ? "correct" : "wrong");
    if (!correct) {
      setWrongText(reason ?? "Not quite. Try again.");
      setAiExplanation(null); setAiThanks(false); setAiRated(false);
      const canExplain = explainable(step, input);
      setAiShown(canExplain); setAiLoading(canExplain);
    }
    if (!correct && explainable(step, input)) {
      const controller = new AbortController();
      const requestId = ++explainRequestId.current;
      explainRequest.current = { id: requestId, controller };
      const isCurrent = () => explainRequest.current?.id === requestId;
      void fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ lessonId: lesson.id, stepId: step.id, input, os: platform.os }) })
        .then(async (response) => {
          if (response.status === 429) {
            if (isCurrent()) setAiExplanation({ id: "", text: "You've used today's AI explanations. They reset at midnight.", cached: false });
            return;
          }
          if (!response.ok) throw new Error("unavailable");
          const result = await response.json() as { id: string; text: string; cached: boolean };
          if (typeof result.id !== "string" || typeof result.text !== "string") throw new Error("unavailable");
          if (!isCurrent()) return;
          setAiExplanation(result);
          try { setAiRated(window.localStorage.getItem(`eg_explain_rated:${result.id}`) === "1"); } catch { setAiRated(false); }
        })
        .catch(() => { if (isCurrent()) setAiExplanation({ id: "", text: "An explanation isn't available right now. Please try again in a moment.", cached: false }); })
        .finally(() => { if (isCurrent()) { explainRequest.current = null; setAiLoading(false); } });
    }
    if (correct) setShowSolution(false);
    if (correct) {
      const points = showSolution ? 0 : Math.round(10 * lesson.difficulty * (state.firstTry[step.id] === undefined ? 1.5 : 1));
      setAnswerPoints(points);
    }
  };
  const rateExplanation = async (helpful: boolean) => {
    if (!aiExplanation?.id || aiRated || aiThanks) return;
    try {
      const response = await fetch(`/api/explain/${encodeURIComponent(aiExplanation.id)}/rate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ helpful }) });
      if (!response.ok) return;
    } catch { return; }
    try { window.localStorage.setItem(`eg_explain_rated:${aiExplanation.id}`, "1"); } catch { /* storage may be disabled */ }
    setAiRated(true); setAiThanks(true);
  };
  const formulaInput = (s: FormulaStep) => sheetRef.current?.getFormula(s.targetCell) ?? rawInput(sheetRef.current?.get(s.targetCell) ?? null);
  const check = (s: FormulaStep) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && stageRef.current?.contains(active)) {
      const draft = active.value;
      commitRef.current = false;
      active.blur();
      if (!commitRef.current) { const result = gradeFormulaStep(s, draft); if (result.reason === "parse_error") return; answer(draft, result.correct, result.correct ? undefined : formulaWrongMessage(result.reason, s, draft)); stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus(); return; }
    }
    const input = formulaInput(s);
    const result = gradeFormulaStep(s, input);
    answer(input, result.correct, result.correct ? undefined : formulaWrongMessage(result.reason, s, input));
    if (!result.correct) stageRef.current?.querySelector<HTMLElement>('[role="grid"]')?.focus();
  };
  const nextStep = () => {
    if (state.complete) { setCelebrate(true); setFeedback(null); return; }
    invalidateExplain(); setAiLoading(false); dispatch({ type: "continue" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false);
  };
  const checkStep = () => {
    if (step.type === "select") { const ref = selectedRef; answer(ref, Boolean(ref) && gradeSelectStep(step, ref)); return; }
    if (step.type === "mcq" && stepReady) answer(stepReady.input, gradeMcqStep(step, Number(stepReady.input)));
    if ((step.type === "picture" || step.type === "project") && stepReady) answer(stepReady.input, gradeAcceptStep(step, stepReady.input));
  };
  const shortcutAttempt = (input: string, _componentCorrect: boolean) => {
    if (step.type !== "shortcut") return;
    const correct = step.mode === "chord" ? gradeShortcutStep(step, input, platform.os) : gradeSequenceStep(step, input.split(" ⟶ "), platform.os);
    answer(input, correct);
  };
  const skipShortcutStep = () => { invalidateExplain(); setAiLoading(false); dispatch({ type: "skip" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false); };
  const skipShortcutSection = () => {
    const remaining = lesson.steps.slice(state.index);
    const ids = remaining.filter((candidate) => candidate.type === "shortcut").map((candidate) => candidate.id);
    if (shortcutSkipOutcome(lesson.steps, state.index, state.correct, lesson.requiredCorrect) === "keyboard-required") {
      setKeyboardUnavailable(true);
      setMobileSkippedShortcutIds((current) => new Set([...current, ...ids]));
      return;
    }
    setMobileSkippedShortcutIds((current) => new Set([...current, ...ids]));
    skipShortcutStep();
  };
  const practiceReady = useCallback((node: HTMLElement | null) => { if (node) node.focus({ preventScroll: true }); }, []);
  const goPrevious = () => { invalidateExplain(); setAiLoading(false); dispatch({ type: "previous" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false); };
  const skipQuestion = () => { invalidateExplain(); setAiLoading(false); dispatch({ type: "skip" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false); };
  const canGoBack = state.history.length > 0, canSkip = step.type !== "info" && step.type !== "shortcut" && feedback !== "correct" && !celebrate;
  useEffect(() => {
    // Tab = skip (also from the grid); Right/Left arrow = skip/previous outside the grid, where arrows move cells.
    // Never while typing in a field, on shortcut steps, in the sidebar, or with modifiers (Shift+Tab still navigates).
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || step.type === "shortcut") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable=true], .pl-lessons, nav, header")) return;
      const outsideGrid = !t?.closest("[role=grid], input");
      if (e.key === "Tab" && canSkip) { e.preventDefault(); e.stopPropagation(); skipQuestion(); }
      else if (e.key === "ArrowRight" && canSkip && outsideGrid) { e.preventDefault(); skipQuestion(); }
      else if (e.key === "ArrowLeft" && canGoBack && outsideGrid) { e.preventDefault(); goPrevious(); }
      // Enter presses Continue wherever focus is; a focused button already handles its own Enter.
      else if (e.key === "Enter" && continueRef.current && !t?.closest("button, a")) { e.preventDefault(); e.stopPropagation(); continueRef.current.click(); }
    };
    window.addEventListener("keydown", onKey, true); // capture: run before the grid's own Tab handling
    return () => window.removeEventListener("keydown", onKey, true);
  });
  const onStageCapture = (e: React.KeyboardEvent<HTMLDivElement>) => {
    commitRef.current = false;
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.target instanceof HTMLElement && e.target.getAttribute("role") === "grid" && step.type === "formula" && feedback !== "correct") { e.preventDefault(); e.stopPropagation(); check(step); }
      else if (e.target instanceof HTMLElement && e.target.getAttribute("role") === "grid" && step.type === "select" && feedback !== "correct") { e.preventDefault(); e.stopPropagation(); checkStep(); }
      else if (e.target instanceof HTMLInputElement && step.type === "mcq" && stepReady) { e.preventDefault(); checkStep(); }
      else if (e.target instanceof HTMLInputElement && (step.type === "picture" || step.type === "project") && stepReady?.input.trim()) { e.preventDefault(); checkStep(); }
    }
  };
  const onStageKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && step.type === "formula" && e.target instanceof HTMLInputElement && commitRef.current) {
      const input = formulaInput(step), result = gradeFormulaStep(step, input);
      commitRef.current = false;
      if (result.reason !== "parse_error") answer(input, result.correct, result.correct ? undefined : formulaWrongMessage(result.reason, step, input));
    }
  };

  const KIND: Record<string, string> = { formula: "Write a formula", select: "Select the cells", shortcut: "Keyboard shortcut", mcq: "Quick check", picture: "Read the picture", project: "Project question", info: "Read this" };
  const hasBrief = step.type === "formula" || step.type === "select";
  // Same rule as answer(): first try is worth 1.5×, nothing once the answer has been shown.
  const stakes = answerPointsVisible(signedIn) ? (showSolution ? 0 : Math.round(10 * lesson.difficulty * (state.firstTry[step.id] === undefined ? 1.5 : 1))) : null;
  const firstTryRun = (() => { let n = 0; for (const ok of Object.values(state.firstTry).reverse()) { if (!ok) break; n++; } return n; })();
  const answered = Object.keys(state.firstTry).length;
  // The counter only moves on once the learner continues, not the moment they answer.
  const challengeNo = String(Math.min(state.correct + (feedback === "correct" ? 0 : 1), lesson.requiredCorrect)).padStart(2, "0");
  const openList = () => listRef.current?.showModal();
  const closeList = () => listRef.current?.close();
  const hud = <header className="pl-hud grid grid-cols-[auto_minmax(0,_1fr)_minmax(220px,_420px)] items-center gap-s5 mb-s5
          [@media(max-width:900px)]:grid-cols-[auto_minmax(0,_1fr)]
          [@media(max-width:640px)]:gap-s3">
    <button type="button" className="pl-hud-btn inline-flex items-center gap-[8px] min-h-[40px] p-[8px_12px] [border:var(--line)] rounded-ledger bg-surface
          text-ink text-ledger-sm font-medium cursor-pointer
          [transition:background-color_var(--d2),_border-color_var(--d2)] [box-shadow:2px_2px_0_var(--ink)]
          [&:hover]:bg-butter
          [@media(max-width:640px)]:[&_span]:hidden
          [&:active]:[transform:translate(2px,_2px)] [&:active]:[box-shadow:none]" onClick={openList} aria-haspopup="dialog"><Icon name="menu" size={16} /><span>Lessons</span></button>
    <div className="pl-hud-title min-w-0
          [&>span]:block [&>span]:[font:500_var(--fs-xs)/1_var(--mono)] [&>span]:tracking-[0.06em] [&>span]:uppercase
          [&>span]:text-muted [&>span]:mb-[6px]"><span>{lesson.module}</span><h1 className="pl-title m-0 text-[clamp(1.35rem,_2.6vw,_1.85rem)] tracking-[-0.025em] overflow-hidden [text-overflow:ellipsis]
          whitespace-nowrap">{lesson.title}</h1></div>
    <div className="pl-progress flex items-center gap-s3
          [@media(max-width:900px)]:[grid-column:1_/_-1]"><ol className="pl-cells [flex:1] grid [grid-auto-flow:column] [grid-auto-columns:minmax(0,_1fr)] gap-[3px] m-0 p-[3px] list-none
          [border:var(--line)] rounded-ledger-sm bg-surface
          [&_li]:h-[14px] [&_li]:rounded-[1px] [&_li]:bg-surface
          [&_li]:[transition:background-color_var(--d3)_var(--ease)] [&_li]:[border:1.5px_solid_var(--ink)]
          [&_li.is-on]:bg-primary [&_li.is-on]:[animation:pl-cell-pop_420ms_var(--ease)]
          [&_li.is-next]:bg-butter [&_li.is-next]:[box-shadow:none]
          [&_li.is-next]:[animation:pl-cell-pulse_1.6s_ease-in-out_infinite]" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>{Array.from({ length: lesson.requiredCorrect }, (_, i) => <li key={i} className={i < state.correct ? "is-on" : i === state.correct && !state.complete ? "is-next" : undefined} />)}</ol><span className="pl-pct num [font:600_var(--fs-sm)_var(--mono)] text-ink whitespace-nowrap">{state.correct}/{lesson.requiredCorrect}</span></div>
  </header>;
  const list = <dialog ref={listRef} className={`pl-list-dialog ${plListDialogClasses}`} aria-label="All lessons" onClick={(e) => { if (e.target === e.currentTarget) closeList(); }}><header><strong>All lessons</strong><button type="button" aria-label="Close lessons" onClick={closeList}><Icon name="x" size={18} /></button></header><LessonList items={lessons} currentId={lesson.id} /></dialog>;

  if (keyboardUnavailable) return <div className="pl-board">{hud}<main className={`pl-arena is-solo ${plArenaClasses}`} id="main"><section className={`pl-card ${plCardClasses}`}><p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]">This lesson needs a keyboard — continue on a computer.</p><Link className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`} aria-keyshortcuts="Enter" href={DASHBOARD_HREF}>Go to dashboard</Link></section></main>{list}</div>;
  return <div className="pl-board">
    {hud}
    {celebrate ? <main className="pl-complete relative overflow-hidden grid [justify-items:start] gap-s4 p-[var(--s7)_var(--s6)] bg-surface
          [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-pop)]
          [@media(max-width:640px)]:p-[var(--s6)_var(--s4)]
          [&_h2]:relative [&_h2]:m-0 [&_h2]:text-[clamp(2rem,_4.6vw,_3.25rem)] [&_h2]:tracking-[-0.035em]
          [&_.eyebrow]:relative [&_.eyebrow]:m-0" id="main" aria-labelledby="pl-done-title">
      <div className="pl-complete-cells absolute top-0 right-0 grid grid-cols-[repeat(8,_44px)] [grid-auto-rows:22px] opacity-[0.9]
          [mask-image:linear-gradient(to_bottom_left,_#000_20%,_transparent_75%)]
          [&_i]:[border-left:1px_solid_var(--border)] [&_i]:[border-bottom:1px_solid_var(--border)] [&_i]:bg-primary-tint
          [&_i]:[animation:pl-fill_700ms_var(--ease)_backwards]
          [&_i:nth-child(5n)]:bg-primary
          [&_i:nth-child(7n)]:bg-highlight" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 8) * 40 + Math.floor(i / 8) * 60}ms` }} />)}</div>
      <p className="eyebrow"><span className="ref">✓</span>{lesson.module}</p>
      <h2 id="pl-done-title">Lesson complete!</h2>
      <Doodle name="trophy" className="pl-trophy draw w-[120px] right-s6 bottom-s6
          [@media(max-width:640px)]:w-[72px] [@media(max-width:640px)]:right-s4 [@media(max-width:640px)]:bottom-s4" fill="var(--highlight)" />
      <dl className={`pl-stats ${plStatsClasses}`}>
        <div><dt>First-try accuracy</dt><dd className="num">{firstTry}%</dd></div>
        <div><dt>Questions correct</dt><dd className="num">{state.correct}</dd></div>
        {savedCelebrationStats && <><div className="is-gold"><dt>Points earned</dt><dd className="num">+{celebrationPoints}</dd></div><div><dt>Day streak</dt><dd className="num">{savedCelebrationStats.streak}</dd></div></>}
      </dl>
      {inviteNotice && <p className="pl-invite-note relative w-full m-[0_0_var(--s3)] p-[var(--s3)_var(--s4)] bg-mint [border:var(--line)] rounded-ledger
          text-ledger-sm text-left" role="note"><strong>No payment needed.</strong> You joined with an invite code, so every lesson is unlocked. Keep going!</p>}
      {saveNote && <p role="status" className="pl-save-note m-0 text-muted text-ledger-sm">{saveNote}</p>}
      <button ref={continueRef} className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`} aria-keyshortcuts="Enter" onClick={() => router.push(completionDestination)}>Continue <span aria-hidden="true">⏎</span></button>
    </main> : <main className={`pl-arena${hasBrief ? "" : " is-solo"} ${plArenaClasses}`} id="main" data-feedback={feedback ?? undefined}>
      {hasBrief && <section className={`pl-brief ${plBriefClasses}`} key={`brief-${state.visit}`} aria-label="Challenge">
        <p className="pl-brief-kicker flex items-center justify-between gap-s2 m-0 [font:500_var(--fs-xs)/1_var(--mono)] tracking-[0.06em] uppercase
          [&_.num]:text-highlight"><span className="num">Challenge {challengeNo}</span><span className="pl-brief-kind p-[4px_8px] [border:1px_solid_rgb(255_255_255_/_0.18)] rounded-[4px] [color:rgb(255_255_255_/_0.75)]">{KIND[step.type]}</span></p>
        <p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]"><RichText text={step.prompt} /></p>
        {(stakes !== null || firstTryRun >= 2) && feedback !== "correct" && <div className="pl-brief-chips flex flex-wrap gap-s2">{stakes !== null && <span className="pl-chip-pts inline-flex items-center gap-[6px] p-[5px_10px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)]
          bg-highlight text-ink">{stakes > 0 ? <>+<span className="num">{stakes}</span> pts{state.firstTry[step.id] === undefined ? " on first try" : ""}</> : "Answer shown · no points"}</span>}{firstTryRun >= 2 && <span className="pl-chip-run inline-flex items-center gap-[6px] p-[5px_10px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)]
          [background:rgb(255_255_255_/_0.1)] [color:#fff] [animation:pl-pop-in_var(--d3)_var(--ease)]"><Icon name="sparkle" size={13} />{firstTryRun} in a row</span>}</div>}
        <p className="pl-brief-tip relative z-[1] m-0 pt-s3 [border-top:1px_solid_rgb(255_255_255_/_0.12)] text-ledger-sm
          [color:rgb(255_255_255_/_0.65)]">{step.type === "formula" ? <>Click <code className="chip">{step.targetCell}</code>, type a formula starting with <code className="chip">=</code>, then press Enter.</> : <>Click or drag across the cells, then press Enter.</>}</p>
      </section>}
      {!hasBrief && step.type !== "info" && <p className="pl-solo-head [grid-column:2_/_span_10] flex items-center gap-s3 m-[0_0_calc(-1_*_var(--s2))]
          [font:500_var(--fs-xs)/1_var(--mono)] tracking-[0.06em] uppercase text-muted
          [animation:pl-enter_var(--d3)_var(--ease)]
          [@media(max-width:900px)]:[grid-column:1_/_-1]
          [&_.num]:text-primary-strong
          [&_.pl-chip-pts]:ml-auto [&_.pl-chip-pts]:tracking-[0] [&_.pl-chip-pts]:[text-transform:none]" key={`head-${state.visit}`}><span className="num">Challenge {challengeNo}</span><span>{KIND[step.type]}</span>{stakes !== null && feedback !== "correct" && <span className="pl-chip-pts inline-flex items-center gap-[6px] p-[5px_10px] rounded-[4px] [font:600_var(--fs-xs)/1.2_var(--mono)]
          bg-highlight text-ink">{stakes > 0 ? `+${stakes} pts` : "No points"}</span>}</p>}
      <div ref={stageRef} className="pl-stage [grid-column:span_8] min-w-0 p-s4 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-2)]
          [transition:box-shadow_var(--d3)_var(--ease),_border-color_var(--d3)_var(--ease)]
          [@media(max-width:900px)]:[grid-column:1_/_-1]
          [@media(max-width:640px)]:p-s3
          [&_.pl-card]:[box-shadow:none]
          [&_.pl-card:last-child]:mb-0
          [&_.pl-options:last-child]:mb-0
          [&_.eg-sheet]:max-w-[none]!" onKeyDownCapture={onStageCapture} onKeyDown={onStageKey}>
        <div className="pl-stage-in [animation:pl-enter_var(--d3)_var(--ease)]" key={`stage-${state.visit}`}>
          {step.type === "formula" ? <Grid key={`${step.id}-${state.visit}`} grid={step.grid} today={LESSON_TODAY} targetCell={step.targetCell} highlightCells={step.highlightCells} sheetRef={sheetRef} onEditStart={() => { setFormulaReady(true); setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} onCommit={() => { commitRef.current = true; setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} /> : step.type === "shortcut" ? <ShortcutPractice key={`${step.id}-${state.visit}`} step={step} os={platform.os} touch={platform.touch} showPostcondition={feedback === "correct"} onAttempt={shortcutAttempt} onSkip={skipShortcutStep} onSkipSection={skipShortcutSection} onPracticeReady={practiceReady} /> : <StepView key={`${step.id}-${state.visit}`} step={step} setSelectRef={(ref) => { if (selectedRef) setSelectTouched(true); setSelectedRef(ref); setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} onReady={(input) => setStepReady({ input })} onEditStart={() => setFeedback((f) => f === "wrong" && !showSolution ? null : f)} />}
        </div>
      </div>
      <div className={`pl-actions${feedback === "correct" ? " is-correct" : ""} ${plActionsClasses}`}>
        {feedback === "correct" ? <><strong className="pl-correct-label inline-flex items-center gap-[10px] [color:#fff] [font:650_1.15rem_var(--font-display)]"><span className="pl-correct-icon grid place-items-center w-[28px] h-[28px] rounded-[50%] bg-primary [color:#fff]
          [animation:pl-pop_420ms_var(--ease)] [border:2px_solid_var(--ink)]" aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></span>Correct!</strong>{answerPointsVisible(signedIn) && <span className="pl-points-earned p-[3px_9px] rounded-[4px] bg-highlight text-ink! [font:700_var(--fs-sm)_var(--mono)] tabular-nums
          [animation:pl-float_600ms_var(--ease)]" aria-live="polite">+{shownPoints} pts</span>}{step.type === "formula" && step.explain ? <span><RichText text={step.explain} /></span> : null}<button ref={continueRef} className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`} aria-keyshortcuts="Enter" onClick={nextStep}>Continue <span aria-hidden="true">⏎</span></button></> : <>
            {canGoBack && <button className={`btn pl-key ${plKeyClasses}`} aria-label="Previous" aria-keyshortcuts="ArrowLeft" onClick={goPrevious}><span aria-hidden="true">←</span> Prev</button>}
            <span className="pl-actions-end ml-auto flex gap-s2
          [@media(max-width:640px)]:[flex:1]">
            {step.type === "info" ? <button ref={continueRef} className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`} aria-keyshortcuts="Enter" onClick={nextStep}>Continue <span aria-hidden="true">⏎</span></button>
              : (step.type === "formula" && formulaReady || (step.type === "select" && selectTouched) || (step.type === "mcq" && stepReady) || ((step.type === "picture" || step.type === "project") && !!stepReady?.input.trim())) ? <button className={`btn pl-key pl-key-enter ${plKeyClasses}
          [&.pl-key-enter]:[--btn-bg:var(--primary)] [&.pl-key-enter]:[--btn-fg:var(--primary-ink)]
          [&.pl-key-enter]:[--btn-edge:var(--primary-strong)] [&.pl-key-enter]:min-w-[9em]
          [&.pl-key-enter:hover]:[--btn-bg:var(--primary-strong)]`} aria-keyshortcuts="Enter" onMouseDown={(e) => e.preventDefault()} onClick={() => step.type === "formula" ? check(step) : checkStep()}>Check <span aria-hidden="true">⏎</span></button>
              : <button className={`btn pl-key ${plKeyClasses}`} aria-keyshortcuts="Tab ArrowRight" onClick={skipQuestion}>Skip question <span aria-hidden="true">⇥</span></button>}
            </span>
          </>}
      </div>
      <div ref={feedbackRef} className="pl-feedback min-h-0 mt-s2 [grid-column:1_/_-1]
          [&:empty]:hidden" aria-live="polite">{feedback === "wrong" && <p className="pl-wrong-summary m-0 p-[10px_14px] rounded-ledger bg-rose text-ink [border:var(--line)]
          [animation:pl-enter_var(--d2)_var(--ease)]">{wrongText}</p>}</div>
      {feedback === "wrong" && <aside className={`pl-drawer ${plDrawerClasses}`} aria-label="Incorrect answer" aria-live="polite"><header><strong>Incorrect</strong><button aria-label="Close" onClick={closeWrong}><Icon name="x" size={18} /></button></header>{state.wrongCount > 0 && !showSolution && <button className="btn pl-show-answer mb-s4" onClick={() => { dispatch({ type: "show-answer" }); setShowSolution(true); focusAnswerControl(); }}>Show Answer</button>}{showSolution && <p className="pl-solution p-[var(--s3)_var(--s4)] rounded-ledger bg-surface-sunk text-text [overflow-wrap:anywhere]">{step.type === "formula" ? <code className="chip">{step.solution}</code> : step.type === "select" ? step.target : step.type === "mcq" ? step.options[step.answer] : step.type === "picture" || step.type === "project" ? step.accept[0] : step.type === "shortcut" ? step.mode === "sequence" ? step.keys[platform.os]?.join(" → ") ?? "Unavailable on Mac" : step.keys[platform.os] ?? "Unavailable on Mac" : ""}</p>}{aiShown && <div className="pl-ai-slot min-h-[100px] p-s4 [border:var(--line)] rounded-ledger bg-surface-warm text-muted
          [&_p]:m-[0_0_var(--s3)] [&_p]:text-text [&_p]:leading-[1.6] [&_p]:[overflow-wrap:anywhere]
          [&_small]:block [&_small]:mt-s3 [&_small]:text-muted [&_small]:leading-[1.4] [&_small]:text-[0.8rem]">{aiLoading ? <span className="pl-ai-loading flex items-center gap-[6px] min-h-[36px]
          [&_i]:w-[7px] [&_i]:h-[7px] [&_i]:rounded-[50%] [&_i]:bg-primary-strong
          [&_i]:[animation:pl-ai-dot_1s_infinite_ease-in-out]
          [&_i:nth-child(2)]:[animation-delay:0.15s]
          [&_i:nth-child(3)]:[animation-delay:0.3s]" role="status" aria-label="Loading explanation"><i /><i /><i /></span> : <><p>{aiExplanation?.text ?? "An explanation isn't available right now. Please try again in a moment."}</p>{signedIn && aiExplanation?.id && (aiThanks ? <p role="status">Thanks for your feedback!</p> : <div className="pl-ai-rating flex gap-s2
          [&_button]:grid [&_button]:place-items-center [&_button]:min-w-[44px] [&_button]:min-h-[44px]
          [&_button]:[border:var(--line)] [&_button]:rounded-ledger [&_button]:bg-surface [&_button]:text-text
          [&_button]:cursor-pointer
          [&_button]:[transition:border-color_var(--d2),_color_var(--d2),_background-color_var(--d2)]
          [&_button:hover:not(:disabled)]:border-primary [&_button:hover:not(:disabled)]:text-primary-strong
          [&_button:disabled]:opacity-[0.5] [&_button:disabled]:cursor-default"><button type="button" aria-label="Helpful" disabled={aiRated} onClick={() => void rateExplanation(true)}><Icon name="thumbUp" size={18} /></button><button type="button" aria-label="Not helpful" disabled={aiRated} onClick={() => void rateExplanation(false)}><Icon name="thumbDown" size={18} /></button></div>)}<small>AI can be wrong. Check the answer before relying on it.</small></>}</div>}</aside>}
    </main>}
    <section className="pl-tiles grid grid-cols-[repeat(12,_minmax(0,_1fr))] gap-s4 mt-s7 pt-s5 [border-top:1px_solid_var(--border)]" aria-label="Your session">
      <div className={`pl-tile pl-tile-stat min-w-0
          [&:empty]:hidden
          ${plTileStatClasses}`}><span>First-try accuracy</span><b className="num">{answered ? `${firstTry}%` : "—"}</b><small>{answered ? `${answered} answered this lesson` : "Answer a question to start"}</small></div>
      <div className={`pl-tile pl-tile-stat min-w-0
          [&:empty]:hidden
          ${plTileStatClasses}`}><span>In a row</span><b className="num">{firstTryRun}</b><small>first-try answers</small></div>
      {boardsReady && <><div className={`pl-tile pl-tile-board min-w-0
          [&:empty]:hidden
          ${plTileBoardClasses}`}><Leaderboards type="points" /></div><div className={`pl-tile pl-tile-board min-w-0
          [&:empty]:hidden
          ${plTileBoardClasses}`}><Leaderboards type="streak" /></div><div className="pl-tile pl-tile-wide min-w-0
          [&:empty]:hidden
          [grid-column:1_/_-1] [order:9]
          [&_.share-bonus-card]:mt-0"><ShareBonus signedIn={signedIn} /></div></>}
      <div className="pl-tile pl-tile-extras min-w-0
          [&:empty]:hidden
          [&>span]:[font:500_var(--fs-xs)/1.2_var(--mono)] [&>span]:tracking-[0.06em] [&>span]:uppercase
          [&>span]:text-muted
          [grid-column:span_2] grid [align-content:start] gap-s2 p-s4 bg-lilac [border:var(--line)] rounded-ledger-lg
          [box-shadow:var(--shadow-1)]
          [@media(900px<width<=1100px)]:[grid-column:span_6]
          [@media(max-width:900px)]:[grid-column:1_/_-1]
          [&_.btn]:w-full [&_.btn]:whitespace-normal"><span>Extras</span><VideoModal videoId={lesson.video} /><a className="btn btn-quiet pl-workbook-link" href={`/api/lessons/${encodeURIComponent(lesson.id)}/workbook`}><Icon name="download" size={16} />Practice workbook</a><div className="pl-share flex flex-wrap gap-[6px] mt-[4px]
          [&_a]:p-[4px_8px] [&_a]:[border:var(--line)] [&_a]:rounded-ledger-sm [&_a]:text-muted [&_a]:text-[0.8rem]
          [&_a]:no-underline [&_a]:[transition:border-color_var(--d2),_color_var(--d2)]
          [&_a:hover]:border-primary [&_a:hover]:text-primary-strong" aria-label="Share"><a href="https://www.linkedin.com/">LinkedIn</a><a href="https://www.facebook.com/">Facebook</a><a href="https://x.com/">X</a><a href="mailto:?subject=Excel%20Guru">Email</a></div></div>
    </section>
    {list}
  </div>;
}
