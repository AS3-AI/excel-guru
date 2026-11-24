"use client";

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
import "./player.css";

type Props = { lesson: Lesson; next: number[]; nextLessonId: string | null; lessons: LessonNavItem[]; signedOutIntro?: boolean; signedIn?: boolean };
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
export function Player({ lesson, next: _next, nextLessonId, lessons, signedOutIntro = false, signedIn = false }: Props) {
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

  if (keyboardUnavailable) return <div className="pl-layout"><LessonList items={lessons} currentId={lesson.id} /><main className="pl"><section className="pl-card"><p>This lesson needs a keyboard — continue on a computer.</p><Link className="btn pl-continue" href={DASHBOARD_HREF}>Go to dashboard</Link></section></main></div>;
  return <div className="pl-layout">
    <LessonList items={lessons} currentId={lesson.id} />
    <main className="pl">
      <h1 className="pl-title">{lesson.title}</h1>
      <div className="pl-progress"><span className="pl-pct">{pct}%</span><div className="pl-bar" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="pl-bar-fill" style={{ width: `${pct}%` }} /></div></div>
      {celebrate ? <section className="pl-card pl-complete"><h2>Lesson complete!</h2><p>First-try accuracy: {firstTry}%</p><p>You answered {state.correct} questions correctly.</p>{savedCelebrationStats && <p>+{celebrationPoints} pts · {savedCelebrationStats.streak}-day streak</p>}{saveNote && <p role="status">{saveNote}</p>}<button ref={continueRef} className="btn pl-continue" onClick={() => router.push(completionDestination)}>Continue →</button></section> : <>
        {(step.type === "formula" || step.type === "select") && <section className="pl-card"><p className="pl-prompt"><RichText text={step.prompt} /></p></section>}
        <div ref={stageRef} className="pl-stage" onKeyDownCapture={onStageCapture} onKeyDown={onStageKey}>
          {step.type === "formula" ? <Grid key={`${step.id}-${state.visit}`} grid={step.grid} today={LESSON_TODAY} targetCell={step.targetCell} highlightCells={step.highlightCells} sheetRef={sheetRef} onEditStart={() => { setFormulaReady(true); setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} onCommit={() => { commitRef.current = true; setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} /> : step.type === "shortcut" ? <ShortcutPractice key={`${step.id}-${state.visit}`} step={step} os={platform.os} touch={platform.touch} showPostcondition={feedback === "correct"} onAttempt={shortcutAttempt} onSkip={skipShortcutStep} onSkipSection={skipShortcutSection} onPracticeReady={practiceReady} /> : <StepView key={`${step.id}-${state.visit}`} step={step} setSelectRef={(ref) => { if (selectedRef) setSelectTouched(true); setSelectedRef(ref); setFeedback((f) => f === "wrong" && !showSolution ? null : f); }} onReady={(input) => setStepReady({ input })} onEditStart={() => setFeedback((f) => f === "wrong" && !showSolution ? null : f)} />}
        </div>
        <div className={`pl-actions${feedback === "correct" ? " is-correct" : ""}`}>
          {feedback === "correct" ? <><strong className="pl-correct-label">Correct!</strong>{answerPointsVisible(signedIn) && <span className="pl-points-earned" aria-live="polite">+{shownPoints} pts</span>}{step.type === "formula" && step.explain ? <span><RichText text={step.explain} /></span> : null}<button ref={continueRef} className="btn pl-continue" onClick={nextStep}>Continue →</button><span className="pl-hint">or press Enter</span></> : <>
            {state.history.length > 0 && <button className="btn pl-key" aria-label="Previous" onClick={() => { invalidateExplain(); setAiLoading(false); dispatch({ type: "previous" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false); }}><span aria-hidden="true">←</span> Prev</button>}
            <span className="pl-actions-end">
            {step.type === "info" ? <button ref={continueRef} className="btn pl-skip" onClick={nextStep}>Continue →</button>
              : (step.type === "formula" && formulaReady || (step.type === "select" && selectTouched) || (step.type === "mcq" && stepReady) || ((step.type === "picture" || step.type === "project") && !!stepReady?.input.trim())) ? <button className="btn pl-key pl-key-enter" aria-keyshortcuts="Enter" onMouseDown={(e) => e.preventDefault()} onClick={() => step.type === "formula" ? check(step) : checkStep()}>Check <span aria-hidden="true">⏎</span></button>
              : <button className="btn pl-skip" onClick={() => { invalidateExplain(); setAiLoading(false); dispatch({ type: "skip" }); setFeedback(null); setShowSolution(false); setStepReady(null); setSelectedRef(""); setSelectTouched(false); }}>Skip question</button>}
            </span>
          </>}
        </div>
        <div ref={feedbackRef} className="pl-feedback" aria-live="polite">{feedback === "wrong" && <p className="pl-wrong-summary">{wrongText}</p>}</div>
        {feedback === "wrong" && <aside className="pl-drawer" aria-label="Incorrect answer" aria-live="polite"><header><strong>Incorrect ({state.wrongCount})</strong><button aria-label="Close" onClick={closeWrong}>×</button></header>{state.wrongCount > 0 && !showSolution && <button className="btn pl-show-answer" onClick={() => { dispatch({ type: "show-answer" }); setShowSolution(true); focusAnswerControl(); }}>Show Answer</button>}{showSolution && <p className="pl-solution">{step.type === "formula" ? <code className="chip">{step.solution}</code> : step.type === "select" ? step.target : step.type === "mcq" ? step.options[step.answer] : step.type === "picture" || step.type === "project" ? step.accept[0] : step.type === "shortcut" ? step.mode === "sequence" ? step.keys[platform.os]?.join(" → ") ?? "Unavailable on Mac" : step.keys[platform.os] ?? "Unavailable on Mac" : ""}</p>}{aiShown && <div className="pl-ai-slot">{aiLoading ? <span className="pl-ai-loading" role="status" aria-label="Loading explanation"><i /><i /><i /></span> : <><p>{aiExplanation?.text ?? "An explanation isn't available right now. Please try again in a moment."}</p>{signedIn && aiExplanation?.id && (aiThanks ? <p role="status">Thanks for your feedback!</p> : <div className="pl-ai-rating"><button type="button" aria-label="Helpful" disabled={aiRated} onClick={() => void rateExplanation(true)}>👍</button><button type="button" aria-label="Not helpful" disabled={aiRated} onClick={() => void rateExplanation(false)}>👎</button></div>)}<small>AI can be wrong. Check the answer before relying on it.</small></>}</div>}</aside>}
      </>}
    </main>
    <aside className="pl-right">{boardsReady && <><Leaderboards type="points" /><Leaderboards type="streak" /><ShareBonus signedIn={signedIn} /></>}<section><h2>Share</h2><div className="pl-share"><a href="https://www.linkedin.com/">LinkedIn</a><a href="https://www.facebook.com/">Facebook</a><a href="https://x.com/">X</a><a href="mailto:?subject=Excel%20Guru">Email</a></div></section><VideoModal videoId={lesson.video} /><a className="btn pl-workbook-link" href={`/api/lessons/${encodeURIComponent(lesson.id)}/workbook`}>Download practice workbook</a></aside>
  </div>;
}
