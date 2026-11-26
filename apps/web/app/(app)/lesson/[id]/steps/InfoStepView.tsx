"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormulaBuildFrame, GridValue, InfoStep } from "@excel-guru/grader";
import { Grid, parseRef } from "@/components/grid/Grid";
import { RichText } from "@/components/RichText";
import { plCardClasses } from "../player-styles";

function cloneGridWithCell(base: GridValue[][], cell: string, val: GridValue): GridValue[][] {
  const pos = parseRef(cell);
  const next = base.map((row) => [...row]);
  if (!pos) return next;
  while (next.length <= pos.r1) next.push([]);
  const row = next[pos.r1]!;
  while (row.length <= pos.c1) row.push(null);
  row[pos.c1] = val;
  return next;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type TimelineTick = {
  delayMs: number;
  draft: string;
  key?: string;
  focusCell?: string;
  highlightCells?: string[];
  yellowCells?: string[];
  resultCell?: string;
  caret: boolean;
  committed: boolean;
};

/** Expand formula-build frames into smooth character-by-character typing + click-to-reference ticks. */
function buildTimeline(frames: FormulaBuildFrame[]): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  let prevDraft = "";
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    if (frame.resultCell) {
      // Brief pause with Enter pressed before committing the cell value.
      ticks.push({
        delayMs: 360,
        draft: frame.draft,
        key: frame.key,
        focusCell: frame.focusCell,
        highlightCells: frame.highlightCells,
        yellowCells: undefined,
        caret: true,
        committed: false,
      });
      ticks.push({
        delayMs: 320,
        draft: frame.draft,
        key: undefined,
        focusCell: frame.focusCell,
        highlightCells: frame.highlightCells,
        yellowCells: frame.yellowCells,
        resultCell: frame.resultCell,
        caret: false,
        committed: true,
      });
      prevDraft = frame.draft;
      continue;
    }

    const isPointClick = frame.key?.startsWith("Click ") ?? false;
    if (
      isPointClick ||
      !frame.draft.startsWith(prevDraft) ||
      frame.draft.length === prevDraft.length
    ) {
      ticks.push({
        delayMs: ticks.length === 0 ? 500 : 420,
        draft: frame.draft,
        key: frame.key,
        focusCell: frame.focusCell,
        highlightCells: frame.highlightCells,
        yellowCells: frame.yellowCells,
        caret: true,
        committed: false,
      });
    } else {
      for (let len = prevDraft.length + 1; len <= frame.draft.length; len++) {
        ticks.push({
          delayMs: ticks.length === 0 ? 500 : 95,
          draft: frame.draft.slice(0, len),
          key: len === frame.draft.length ? frame.key : undefined,
          focusCell: frame.focusCell,
          highlightCells: len === frame.draft.length ? frame.highlightCells : undefined,
          yellowCells: frame.yellowCells,
          caret: true,
          committed: false,
        });
      }
    }
    prevDraft = frame.draft;
  }
  return ticks;
}

export function InfoStepView({ step }: { step: InfoStep }) {
  const anim = step.animation;
  const [locatePhase, setLocatePhase] = useState<number>(2);
  const [tickIndex, setTickIndex] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [replayNonce, setReplayNonce] = useState<number>(0);
  const [toggled, setToggled] = useState<boolean>(false);
  const [flashKey, setFlashKey] = useState<number>(0);
  const [still, setStill] = useState<boolean>(false);

  const timeline = useMemo(
    () => (anim?.kind === "formula-build" ? buildTimeline(anim.frames) : []),
    [anim],
  );

  useEffect(() => {
    const isReduced = reducedMotion();
    setStill(isReduced);
    if (isReduced && timeline.length > 0) {
      setTickIndex(timeline.length - 1);
    }
  }, [step.id, timeline.length]);

  // Beat 1: smooth column -> row -> cell intersection locate.
  useEffect(() => {
    if (anim?.kind !== "cell-locate") return;
    if (reducedMotion()) {
      setLocatePhase(2);
      return;
    }
    setLocatePhase(0);
    const t1 = window.setTimeout(() => setLocatePhase(1), 650);
    const t2 = window.setTimeout(() => {
      setLocatePhase(2);
      setFlashKey((k) => k + 1);
    }, 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [step.id, anim?.kind, replayNonce]);

  // Beat 3 & 5: smooth character-by-character / click-to-ref timeline with gentle hold & loop.
  useEffect(() => {
    if (anim?.kind !== "formula-build" || timeline.length === 0 || still || paused) return;
    const isEnd = tickIndex >= timeline.length - 1;
    const delay = isEnd ? 3400 : (timeline[tickIndex + 1]?.delayMs ?? 120);
    const timer = window.setTimeout(() => {
      if (isEnd) {
        setTickIndex(0);
      } else {
        const next = tickIndex + 1;
        setTickIndex(next);
        if (timeline[next]?.resultCell) setFlashKey((k) => k + 1);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [anim?.kind, timeline, tickIndex, still, paused, replayNonce]);

  const liveUpdate =
    anim?.kind === "live-update"
      ? anim.liveUpdate
      : anim?.kind === "formula-build"
        ? anim.liveUpdate
        : undefined;

  const computedGrid = useMemo(() => {
    if (!step.grid) return undefined;
    if (!liveUpdate || !toggled) return step.grid;
    return cloneGridWithCell(step.grid, liveUpdate.watchCell, liveUpdate.toValue);
  }, [step.grid, liveUpdate, toggled]);

  const activeTick = anim?.kind === "formula-build" && !toggled ? timeline[tickIndex] : undefined;

  const activeCell =
    anim?.kind === "cell-locate"
      ? locatePhase >= 2
        ? anim.cell
        : undefined
      : (activeTick?.focusCell ?? step.activeCell);

  const yellowCells = useMemo(() => {
    if (anim?.kind === "cell-locate") {
      return locatePhase >= 2 ? [anim.cell] : [];
    }
    if (toggled && liveUpdate) return [liveUpdate.watchCell, liveUpdate.resultCell];
    if (activeTick?.yellowCells) return activeTick.yellowCells;
    return step.yellowCells;
  }, [anim, locatePhase, activeTick, toggled, liveUpdate, step.yellowCells]);

  const highlightCells = useMemo(() => {
    if (anim?.kind === "cell-locate") {
      if (locatePhase === 0) return [`${anim.col}:${anim.col}`];
      if (locatePhase === 1) return [`${anim.col}:${anim.col}`, `${anim.row}:${anim.row}`];
      return undefined;
    }
    if (toggled) return step.highlightCells;
    return activeTick ? activeTick.highlightCells : step.highlightCells;
  }, [anim, locatePhase, toggled, activeTick, step.highlightCells]);

  const highlightHeaders = useMemo(() => {
    if (anim?.kind !== "cell-locate") return undefined;
    return {
      cols: locatePhase >= 0 ? [anim.col] : [],
      rows: locatePhase >= 1 ? [anim.row] : [],
    };
  }, [anim, locatePhase]);

  const flashCells = useMemo(() => {
    if (anim?.kind === "cell-locate" && locatePhase >= 2) return [anim.cell];
    if (activeTick?.resultCell) return [activeTick.resultCell];
    if (liveUpdate && flashKey > 0) return [liveUpdate.watchCell, liveUpdate.resultCell];
    return undefined;
  }, [anim, locatePhase, activeTick, liveUpdate, flashKey]);

  const activeKey = activeTick?.key;

  const sheetControls =
    !still && (anim?.kind === "cell-locate" || anim?.kind === "formula-build") ? (
      <span className="inline-flex items-center gap-[6px]">
        {anim.kind === "formula-build" && (
          <button
            type="button"
            className="cursor-pointer rounded-[4px] border border-solid border-border bg-surface px-[7px] py-[2px] font-ledger-code text-[11px] font-semibold text-ink hover:bg-surface-warm"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Play" : "Pause"}
          </button>
        )}
        <button
          type="button"
          className="cursor-pointer rounded-[4px] border border-solid border-border bg-surface px-[7px] py-[2px] font-ledger-code text-[11px] font-semibold text-ink hover:bg-surface-warm"
          onClick={() => {
            setPaused(false);
            setToggled(false);
            setTickIndex(0);
            setReplayNonce((n) => n + 1);
          }}
        >
          Replay
        </button>
      </span>
    ) : null;

  return (
    <div className="grid gap-s4">
      <section className={`pl-card mb-0! ${plCardClasses}`}>
        {step.topic && (
          <p className="m-[0_0_var(--s2)] [font:600_var(--fs-xs)/1.2_var(--mono)] tracking-[0.06em] uppercase text-primary-strong">
            {step.topic}
          </p>
        )}
        <p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.6]">
          <RichText text={step.text} />
        </p>
        {step.keycaps && step.keycaps.length > 0 && (
          <div
            className="mt-s3 flex flex-wrap items-center gap-[8px]"
            aria-label="Keys and actions"
          >
            {step.keycaps.map((label, i) => {
              const pressed = activeKey !== undefined && activeKey === label;
              return (
                <span key={`${label}-${i}`} className="inline-flex items-center gap-[8px]">
                  <kbd className={`eg-kbd${pressed ? " is-pressed" : ""}`}>{label}</kbd>
                  {i < step.keycaps!.length - 1 && (
                    <span className="text-muted text-ledger-xs" aria-hidden="true">
                      →
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {computedGrid && (
        <div className="grid gap-s3">
          {liveUpdate && (
            <div className="flex flex-wrap items-center gap-s2">
              <button
                type="button"
                className={`btn btn-sm ${toggled ? "btn-gold" : ""}`}
                onClick={() => {
                  setToggled((v) => !v);
                  setPaused(true);
                  setFlashKey((k) => k + 1);
                }}
              >
                {toggled
                  ? (liveUpdate.resetLabel ??
                    `Reset ${liveUpdate.watchCell}: ${String(liveUpdate.toValue)} → ${String(liveUpdate.fromValue)}`)
                  : (liveUpdate.buttonLabel ??
                    `Change ${liveUpdate.watchCell}: ${String(liveUpdate.fromValue)} → ${String(liveUpdate.toValue)}`)}
              </button>
            </div>
          )}

          <Grid
            grid={computedGrid}
            displayOnly
            showFormulaBar={step.showFormulaBar ?? true}
            activeCell={activeCell}
            selection={step.selection}
            highlightCells={highlightCells}
            yellowCells={yellowCells}
            highlightHeaders={highlightHeaders}
            flashCells={flashCells}
            flashKey={flashKey}
            previewCell={anim?.kind === "formula-build" ? anim.targetCell : undefined}
            previewDraft={activeTick?.draft}
            previewCaret={activeTick?.caret ?? false}
            previewInCell={activeTick ? !activeTick.committed : true}
            onInspectCell={() => setPaused(true)}
            sheetBarRight={sheetControls}
          />
        </div>
      )}
    </div>
  );
}
