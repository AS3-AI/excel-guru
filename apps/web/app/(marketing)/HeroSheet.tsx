"use client";

import { useEffect, useState } from "react";

// Each scene reuses the same sheet; B6 changes meaning. Values come from B2:B5 = 1,240 / 980 / 1,410 / 1,190.
const SCENES = [
  { lesson: "SUM", task: "Total the four regions in B6.", label: "Total", formula: "=SUM(B2:B5)", result: "4,820", note: "SUM adds every cell from B2 to B5." },
  { lesson: "AVERAGE", task: "Find the average sale in B6.", label: "Average", formula: "=AVERAGE(B2:B5)", result: "1,205", note: "AVERAGE divides the total by the four cells." },
  { lesson: "MAX", task: "Find the biggest sale in B6.", label: "Highest", formula: "=MAX(B2:B5)", result: "1,410", note: "MAX returns the largest value in the range." },
  { lesson: "COUNTIF", task: "Count regions above 1,000 in B6.", label: "Above 1,000", formula: '=COUNTIF(B2:B5,">1000")', result: "3", note: "COUNTIF counts only the cells that match." },
];

const TYPE_MS = 60;
const START_DELAY_MS = 600;
const ENTER_DELAY_MS = 350;
const HOLD_MS = 2800;

export function HeroSheet() {
  const [scene, setScene] = useState(0);
  const [typed, setTyped] = useState(0);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  const s = SCENES[scene] ?? SCENES[0]!;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      setTyped(SCENES[0]!.formula.length);
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (still || paused) return;
    let t: ReturnType<typeof setTimeout>;
    if (done) {
      t = setTimeout(() => {
        setDone(false);
        setTyped(0);
        setScene((v) => (v + 1) % SCENES.length);
      }, HOLD_MS);
    } else if (typed < s.formula.length) {
      t = setTimeout(() => setTyped(typed + 1), typed === 0 ? START_DELAY_MS : TYPE_MS);
    } else {
      t = setTimeout(() => setDone(true), ENTER_DELAY_MS);
    }
    return () => clearTimeout(t);
  }, [still, paused, done, typed, s.formula.length]);

  const shown = s.formula.slice(0, typed);
  const refAt = shown.indexOf("B2:B5");
  const refOn = refAt >= 0;
  const n = (v: string) => <div className={`n${refOn ? " in-ref" : ""}`}>{v}</div>;

  return (
    <figure className="sheet" aria-label="A lesson that loops through formulas: SUM, AVERAGE, MAX and COUNTIF, each typed into the formula bar and marked correct" style={{ margin: 0 }}>
      <div className="sheet-bar">
        <span className="sheet-file" aria-hidden="true">sales.xlsx</span>
        <span className="sheet-lesson" aria-hidden="true">Lesson · {s.lesson}</span>
        {!still && (
          <button type="button" className="sheet-pause" aria-pressed={paused} aria-label={paused ? "Play demo" : "Pause demo"} onClick={() => setPaused((v) => !v)}>
            {paused ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" fill="currentColor" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5h2v9H3zM7 1.5h2v9H7z" fill="currentColor" /></svg>
            )}
          </button>
        )}
      </div>
      <div className="sheet-task" aria-hidden="true">
        <p>{s.task}</p>
        <small>Type a formula, then press Enter.</small>
      </div>
      <div className="fx" aria-hidden="true">
        <em>B6</em>
        <b>fx</b>
        <span>
          {refOn ? <>{shown.slice(0, refAt)}<span className="ref-text">B2:B5</span>{shown.slice(refAt + 5)}</> : shown}
          <i className="caret" data-idle={done || undefined} />
        </span>
      </div>
      <div className="grid-sheet" aria-hidden="true">
        <div className="h" /><div className="h">A</div><div className="h">B</div>
        <div className="h">1</div><div><b>Region</b></div><div className="n"><b>Sales</b></div>
        <div className="h">2</div><div>North</div>{n("1,240")}
        <div className="h">3</div><div>South</div>{n("980")}
        <div className="h">4</div><div>East</div>{n("1,410")}
        <div className="h">5</div><div>West</div>{n("1,190")}
        <div className="h">6</div><div><b>{s.label}</b></div>
        <div className="sel"><span data-show={done || undefined}>{s.result}</span></div>
      </div>
      <div className="feedback" data-show={done || undefined} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18" /><path d="m6 10.5 3 3 5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span><strong>Correct.</strong> {s.note}</span>
      </div>
    </figure>
  );
}
