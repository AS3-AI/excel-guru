"use client";

import { useEffect, useState } from "react";

const sheetClasses = [
  "relative z-[1] bg-surface [border:var(--line)] rounded-ledger-lg overflow-hidden [box-shadow:var(--shadow-2)]",
  "text-[0.9rem] [transition:transform_0.4s_var(--ease),_box-shadow_0.4s_var(--ease)]",
  "[@media(hover:hover)]:[&:hover]:[transform:translate(-3px,_-3px)]",
  "[@media(hover:hover)]:[&:hover]:[box-shadow:8px_8px_0_var(--ink)]",
].join(" ");

const fxClasses = [
  "flex items-stretch [border-bottom:2px_solid_var(--ink)] [font:500_0.88rem_var(--mono)]",
  "[&_em]:grid [&_em]:place-items-center [&_em]:min-w-[52px] [&_em]:p-[0_10px] [&_em]:[border-right:2px_solid_var(--ink)]",
  "[&_em]:text-ink [&_em]:[font-style:normal] [&_em]:font-semibold [&_em]:bg-surface-sunk",
  "[&_b]:grid [&_b]:place-items-center [&_b]:p-[0_12px] [&_b]:text-primary-strong",
  "[&_b]:[border-right:1px_solid_var(--border)] [&_b]:[font-style:italic] [&_b]:font-semibold",
  "[&>span]:overflow-hidden [&>span]:whitespace-nowrap [&>span]:p-[9px_14px] [&>span]:text-ink [&>span]:flex",
  "[&>span]:items-center [&>span]:min-h-[40px]",
  "[&_.ref-text]:text-track-sql [&_.ref-text]:font-semibold",
].join(" ");

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
    <figure className={`sheet ${sheetClasses}`} aria-label="A lesson that loops through formulas: SUM, AVERAGE, MAX and COUNTIF, each typed into the formula bar and marked correct" style={{ margin: 0 }}>
      <div className="sheet-bar flex items-center gap-s3 p-[10px_12px_10px_16px] [border-bottom:var(--line)] bg-butter [font:600_0.78rem_var(--mono)]
          whitespace-nowrap">
        <span className="sheet-file text-ink" aria-hidden="true">sales.xlsx</span>
        <span className="sheet-lesson text-ink pl-s3 [border-left:2px_solid_var(--ink)]" aria-hidden="true">Lesson · {s.lesson}</span>
        {!still && (
          <button type="button" className="sheet-pause ml-auto grid place-items-center w-[30px] h-[30px] [border:var(--line)] rounded-ledger-sm bg-surface text-ink
          cursor-pointer [box-shadow:2px_2px_0_var(--ink)] [transition:transform_var(--d1),_box-shadow_var(--d1)]
          [&:active]:[transform:translate(2px,_2px)] [&:active]:[box-shadow:none]" aria-pressed={paused} aria-label={paused ? "Play demo" : "Pause demo"} onClick={() => setPaused((v) => !v)}>
            {paused ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" fill="currentColor" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5h2v9H3zM7 1.5h2v9H7z" fill="currentColor" /></svg>
            )}
          </button>
        )}
      </div>
      <div className="sheet-task p-[16px_20px] min-h-[78px] [border-bottom:2px_solid_var(--ink)] [border-left:6px_solid_var(--primary)]
          [&_p]:m-0 [&_p]:text-ink [&_p]:[font-weight:650]
          [&_small]:text-muted" aria-hidden="true">
        <p>{s.task}</p>
        <small>Type a formula, then press Enter.</small>
      </div>
      <div className={`fx ${fxClasses}`} aria-hidden="true">
        <em>B6</em>
        <b>fx</b>
        <span>
          {refOn ? <>{shown.slice(0, refAt)}<span className="ref-text">B2:B5</span>{shown.slice(refAt + 5)}</> : shown}
          <i className="caret inline-block w-[2px] h-[1.1em] bg-ink ml-[1px] [animation:blink_1s_steps(1)_infinite]
          [&[data-idle]]:opacity-0 [&[data-idle]]:[animation:none]
          [@media(prefers-reduced-motion:reduce)]:hidden" data-idle={done || undefined} />
        </span>
      </div>
      <div className="grid-sheet grid grid-cols-[40px_1fr_1fr] [font:500_0.9rem_var(--mono)] tabular-nums
          [&>div]:p-[9px_14px] [&>div]:[border-right:1px_solid_var(--border)] [&>div]:[border-bottom:1px_solid_var(--border)]
          [&>div]:min-h-[39px] [&>div]:[transition:background-color_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]
          [&>div:nth-child(3n)]:[border-right:0]
          [&_.h]:bg-surface-sunk [&_.h]:text-muted [&_.h]:text-center [&_.h]:text-[0.76rem] [&_.h]:p-[10px_0]
          [&_.n]:text-right
          [&_.in-ref]:[background:color-mix(in_srgb,_var(--track-sql)_12%,_var(--surface))]
          [&_.in-ref]:[box-shadow:inset_2px_0_0_var(--track-sql),_inset_-2px_0_0_var(--track-sql)]
          [&_.in-ref:nth-child(9)]:[box-shadow:inset_2px_2px_0_var(--track-sql),_inset_-2px_0_0_var(--track-sql)]
          [&_.in-ref:nth-child(18)]:[box-shadow:inset_2px_-2px_0_var(--track-sql),_inset_-2px_0_0_var(--track-sql)]
          [&_.sel]:[box-shadow:inset_0_0_0_2px_var(--primary)] [&_.sel]:relative [&_.sel]:text-right [&_.sel]:text-ink
          [&_.sel]:font-bold [&_.sel]:[background:color-mix(in_srgb,_var(--primary)_9%,_var(--surface))]
          [&_.sel::after]:[content:''] [&_.sel::after]:absolute [&_.sel::after]:right-[-3px] [&_.sel::after]:bottom-[-3px]
          [&_.sel::after]:w-[6px] [&_.sel::after]:h-[6px] [&_.sel::after]:bg-primary
          [&_.sel::after]:[border:1px_solid_var(--surface)]
          [&_.sel_span]:inline-block [&_.sel_span]:opacity-0 [&_.sel_span]:[transform:scale(0.8)]
          [&_.sel_span]:[transition:opacity_0.3s_var(--ease),_transform_0.3s_var(--ease)]
          [&_.sel_span[data-show]]:opacity-[1] [&_.sel_span[data-show]]:[transform:none]" aria-hidden="true">
        <div className="h" /><div className="h">A</div><div className="h">B</div>
        <div className="h">1</div><div><b>Region</b></div><div className="n"><b>Sales</b></div>
        <div className="h">2</div><div>North</div>{n("1,240")}
        <div className="h">3</div><div>South</div>{n("980")}
        <div className="h">4</div><div>East</div>{n("1,410")}
        <div className="h">5</div><div>West</div>{n("1,190")}
        <div className="h">6</div><div><b>{s.label}</b></div>
        <div className="sel"><span data-show={done || undefined}>{s.result}</span></div>
      </div>
      <div className="feedback flex items-center gap-[10px] m-[14px] p-[12px_14px] [border:var(--line)] rounded-ledger bg-mint text-ink opacity-0
          [transform:translateY(6px)] [transition:opacity_0.4s_var(--ease),_transform_0.4s_var(--ease)]
          [&[data-show]]:opacity-[1] [&[data-show]]:[transform:none]
          [&_svg]:[flex:none] [&_svg]:text-primary-strong
          [&_span]:text-[0.88rem]" data-show={done || undefined} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".18" /><path d="m6 10.5 3 3 5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span><strong>Correct.</strong> {s.note}</span>
      </div>
    </figure>
  );
}
