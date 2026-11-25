"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, nextRecommendedPath, statusCounts, type StatusTag } from "@/lib/modules";
import { mergeLocalProgress, readLocalProgress } from "@/lib/local-progress";
import { Leaderboards } from "@/components/Leaderboards";
import { ShareBonus } from "@/components/ShareBonus";
import { Icon } from "@/components/icons";

const moduleCardClasses = [
  "relative h-full flex flex-col gap-[6px] p-s4 bg-surface [border:var(--line)] rounded-ledger text-text no-underline",
  "[transition:border-color_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease),_transform_var(--d2)_var(--ease)]",
  "[box-shadow:var(--shadow-1)]",
  "[&:hover]:border-ink [&:hover]:[box-shadow:5px_5px_0_var(--ink)] [&:hover]:no-underline",
  "[&:hover]:[transform:translate(-2px,_-2px)] [&:hover]:bg-butter",
  "[&_strong]:text-ink [&_strong]:[font-family:var(--font-display)] [&_strong]:font-semibold [&_strong]:text-[1.05rem]",
  "[&_strong]:tracking-[-0.01em]",
  "[&_.meter]:mt-[auto]",
  "[&.is-done]:bg-mint",
].join(" ");

type DashboardProps = { signedIn: boolean; progressLoaded: boolean; completedIds: string[]; tags: StatusTag[]; moduleDone: Record<string, number>; order: string[]; lessonModules: Record<string, string> };

export function DashboardContent({ signedIn: initiallySignedIn, progressLoaded, completedIds: initialDone, tags, moduleDone: initialModuleDone, order, lessonModules }: DashboardProps) {
  const [signedIn, setSignedIn] = useState(initiallySignedIn);
  const [done, setDone] = useState(initialDone);
  const [completedCount, setCompletedCount] = useState(initialDone.length);
  const [moduleDone, setModuleDone] = useState(initialModuleDone);
  const [recommendedPath, setRecommendedPath] = useState(nextRecommendedPath(order, initialDone));
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [dashboardReady, setDashboardReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void (async () => {
      const local = readLocalProgress();
      if (initiallySignedIn && progressLoaded && !local.length) {
        if (active) setDashboardReady(true);
        return;
      }
      if (initiallySignedIn && local.length) await mergeLocalProgress();
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) { if (active) setDashboardReady(true); return; }
        const data = await response.json() as { modules?: { id: string; done: number }[]; nextLessonId?: string | null };
        if (!active) return;
        setSignedIn(true);
        setModuleDone(Object.fromEntries((data.modules ?? []).map((item) => [item.id.toLowerCase(), item.done])));
        setCompletedCount((data.modules ?? []).reduce((sum, item) => sum + item.done, 0));
        setRecommendedPath(data.nextLessonId ? `/lesson/${data.nextLessonId}` : "/review");
        setDashboardReady(true);
        if (local.length && initiallySignedIn) router.refresh();
      } catch { if (active) setDashboardReady(true); /* Keep server-rendered progress visible if the refresh fails. */ }
    })();
    return () => { active = false; };
  }, [initiallySignedIn, progressLoaded, router]);
  useEffect(() => { if (!initiallySignedIn) { const localDone = readLocalProgress().map((item) => item.lessonId); setDone(localDone); setCompletedCount(localDone.length); setModuleDone(Object.fromEntries(MODULES.map((module) => [module.title.toLowerCase(), order.filter((id) => lessonModules[id]?.toLowerCase() === module.title.toLowerCase() && localDone.includes(id)).length]))); } }, [initiallySignedIn, order, lessonModules]);
  const doneCount = signedIn ? completedCount : done.length;
  const modules = MODULES.map((module) => ({ ...module, done: moduleDone[module.title.toLowerCase()] ?? 0 }));
  const counts = statusCounts(tags);
  const reset = async () => {
    setConfirm(false);
    const response = await fetch("/api/progress/reset", { method: "POST" });
    setMessage(response.ok ? "Progress reset." : "Could not reset progress. Please try again.");
    if (response.ok) window.location.reload();
  };
  const total = modules.reduce((sum, m) => sum + m.total, 0);
  const pct = Math.min(100, Math.round(doneCount / total * 100));
  const nextHref = signedIn ? recommendedPath : nextRecommendedPath(order, done);
  const legend = [
    { key: "good", label: "Good", n: counts.good, color: "var(--primary)" },
    { key: "practice", label: "Needs practice", n: counts.practice, color: "var(--warning)" },
    { key: "low", label: "Low accuracy", n: counts.low, color: "var(--danger)" },
  ];
  return <main className="dashboard wrap pt-s7 pb-s8
          [@media(max-width:720px)]:pt-s5" id="main">
    <header className="dash-head flex flex-wrap items-end justify-between gap-s5 mb-s6
          [&_h1]:m-0 [&_h1]:text-[clamp(1.9rem,_4.4vw,_2.75rem)] [&_h1]:tracking-[-0.03em]
          [&_.eyebrow]:mb-s3
          [@media(max-width:720px)]:[&_.btn]:w-full">
      <div><p className="eyebrow"><span className="ref">A1</span>Dashboard</p><h1>{doneCount === 0 ? "Let’s start your first lesson" : "Pick up where you left off"}</h1></div>
      <Link className="btn btn-lg" href={nextHref}>{doneCount === 0 ? "Start learning" : "Continue learning"} <Icon name="arrowRight" size={18} /></Link>
    </header>
    <section className="dash-summary grid grid-cols-[minmax(0,_1fr)_minmax(0,_1fr)] bg-surface [border:var(--line)] rounded-ledger-lg
          [box-shadow:var(--shadow-2)] overflow-hidden
          [@media(max-width:720px)]:grid-cols-[minmax(0,_1fr)]" aria-label="Progress summary">
      <div className="dash-stat p-[var(--s5)_var(--s6)_var(--s6)] min-w-0
          [.dash-stat+&]:[border-left:var(--line)]
          [&_h2]:m-[0_0_var(--s3)] [&_h2]:[font:500_var(--fs-xs)/1_var(--mono)] [&_h2]:tracking-[0.06em] [&_h2]:uppercase
          [&_h2]:text-muted
          [@media(max-width:720px)]:[.dash-stat+&]:[border-top:1px_solid_var(--border)]
          [&:first-child]:bg-mint">
        <h2>Lessons completed</h2>
        <p className="dash-count num m-[0_0_var(--s4)] text-[2.75rem] font-semibold leading-[1] text-ink
          [&_span]:ml-[8px] [&_span]:text-[1.1rem] [&_span]:text-muted [&_span]:font-medium">{doneCount}<span>/ {total}</span></p>
        <div className="meter" role="progressbar" aria-label="Curriculum progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        <p className="dash-note m-[var(--s3)_0_0] text-muted text-ledger-sm">{pct}% of the curriculum · certificate unlocks at 100%</p>
      </div>
      <div className="dash-stat p-[var(--s5)_var(--s6)_var(--s6)] min-w-0
          [.dash-stat+&]:[border-left:var(--line)]
          [&_h2]:m-[0_0_var(--s3)] [&_h2]:[font:500_var(--fs-xs)/1_var(--mono)] [&_h2]:tracking-[0.06em] [&_h2]:uppercase
          [&_h2]:text-muted
          [@media(max-width:720px)]:[.dash-stat+&]:[border-top:1px_solid_var(--border)]
          [&:first-child]:bg-mint">
        <h2>First-try accuracy</h2>
        <div className="status-bar flex gap-0 h-[14px] m-[var(--s2)_0_var(--s4)] rounded-ledger-sm overflow-hidden [border:var(--line)]
          [&_span]:[flex-basis:0] [&_span]:min-w-0 [&_span]:h-full
          [&_span.is-empty]:[flex-grow:1] [&_span.is-empty]:bg-surface-sunk
          [&_span.is-empty]:[box-shadow:inset_0_0_0_1px_var(--border)] [&_span.is-empty]:rounded-[3px]" aria-hidden="true">{legend.map((l) => <span key={l.key} style={{ flexGrow: l.n, background: l.color }} />)}{counts.good + counts.practice + counts.low === 0 && <span className="is-empty" />}</div>
        <ul className="dash-legend list-none m-0 p-0 grid gap-s2
          [&_li]:flex [&_li]:items-center [&_li]:gap-[10px] [&_li]:text-ledger-sm [&_li]:text-text
          [&_i]:w-[10px] [&_i]:h-[10px] [&_i]:rounded-[2px] [&_i]:[flex:none]
          [&_b]:ml-auto [&_b]:text-ink [&_b]:font-semibold">{legend.map((l) => <li key={l.key}><i style={{ background: l.color }} aria-hidden="true" />{l.label}<b className="num">{l.n}</b></li>)}</ul>
      </div>
    </section>
    <section className="dash-block mt-s7" aria-labelledby="modules-title">
      <div className="dash-block-head flex items-baseline justify-between gap-s3 pb-s3 mb-s4 [border-bottom:var(--line)]
          [&_h2]:m-0 [&_h2]:text-ledger-lg"><h2 id="modules-title">Modules</h2><span className="dash-sub text-muted text-ledger-sm">{modules.filter((m) => m.done >= m.total).length} of {modules.length} complete</span></div>
      <ol className="module-grid list-none m-0 p-0 grid grid-cols-[repeat(auto-fill,_minmax(210px,_1fr))] gap-s3
          [@media(380px<width<=720px)]:grid-cols-[repeat(2,_minmax(0,_1fr))]
          [@media(max-width:380px)]:grid-cols-[minmax(0,_1fr)]">{modules.map((module) => { const complete = module.done >= module.total; return <li key={module.slug}><Link className={`module-card${complete ? " is-done" : ""} ${moduleCardClasses}`} href={`/modules/${module.slug}`}>
        <span className="module-top flex items-center justify-between min-h-[20px]"><span className="module-num num text-ledger-xs text-ink font-semibold" aria-hidden="true">{String(module.order).padStart(2, "0")}</span>{complete && <span className="module-check grid place-items-center w-[20px] h-[20px] rounded-[50%] bg-primary text-primary-ink [border:2px_solid_var(--ink)]" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.75} /></span>}</span>
        <strong>{module.title}</strong>
        <span className="module-meta text-muted text-ledger-sm mb-[6px]"><span className="num">{module.done}/{module.total}</span> lessons{complete && <span className="sr-only"> — complete</span>}</span>
        <span className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, module.done / module.total * 100)}%` }} /></span>
      </Link></li>; })}</ol>
    </section>
    {dashboardReady && <section className="dash-block mt-s7" aria-label="Leaderboards"><div className="dash-leaderboards grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-s4
          [@media(max-width:720px)]:grid-cols-[minmax(0,_1fr)]
          [&_.leaderboard-card]:[box-shadow:var(--shadow-1)]"><Leaderboards type="points" /><Leaderboards type="streak" /></div><ShareBonus signedIn={signedIn} /></section>}
    <section className="dash-block dash-soon mt-s7
          grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-s4
          [&>div]:p-s5 [&>div]:[border:1px_dashed_var(--border-strong)] [&>div]:rounded-ledger-lg [&>div]:bg-surface
          [&_h2]:m-[var(--s3)_0_4px] [&_h2]:text-ledger-md
          [&_p]:m-0 [&_p]:text-muted [&_p]:text-ledger-sm
          [&_.badge]:bg-surface-sunk [&_.badge]:text-muted
          [@media(max-width:720px)]:grid-cols-[minmax(0,_1fr)]
          [&>div:first-child]:bg-lilac
          [&>div:last-child]:bg-sky" aria-label="Coming soon">
      <div><span className="badge">Soon</span><h2>Projects</h2><p>Practice on real datasets, end to end.</p></div>
      <div><span className="badge">Soon</span><h2>Daily challenge</h2><p>Scores and daily streaks will appear here.</p></div>
    </section>
    {signedIn && <footer className="dash-danger flex flex-wrap items-center justify-between gap-s3 mt-s8 pt-s5 [border-top:1px_solid_var(--border)]
          [&_strong]:text-ink [&_strong]:text-[0.95rem]
          [&_p]:m-[2px_0_0] [&_p]:text-muted [&_p]:text-ledger-sm
          [&_.btn]:text-danger"><div><strong>Reset progress</strong><p>Clears completed lessons. Points and streak stay.</p></div><button className="btn btn-quiet btn-sm" onClick={() => setConfirm(true)}>Reset…</button></footer>}
    {message && <p role="status" className="dash-message mt-s3 text-muted">{message}</p>}
    {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(false); }} onKeyDown={(e) => { if (e.key === "Escape") setConfirm(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Reset lesson progress?</h2><p>Your completed lessons will be cleared. Points and streak will stay.</p><div className="modal-actions"><button className="btn btn-quiet" autoFocus onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-danger" onClick={() => void reset()}>Reset progress</button></div></section></div>}
  </main>;
}
