"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, nextRecommendedPath, statusCounts, type StatusTag } from "@/lib/modules";
import { mergeLocalProgress, readLocalProgress } from "@/lib/local-progress";
import { Leaderboards } from "@/components/Leaderboards";
import { ShareBonus } from "@/components/ShareBonus";
import { Icon } from "@/components/icons";

type DashboardProps = { signedIn: boolean; completedIds: string[]; tags: StatusTag[]; moduleDone: Record<string, number>; order: string[]; lessonModules: Record<string, string> };

export function DashboardContent({ signedIn: initiallySignedIn, completedIds: initialDone, tags, moduleDone: initialModuleDone, order, lessonModules }: DashboardProps) {
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
  }, [initiallySignedIn, router]);
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
  return <main className="dashboard wrap" id="main">
    <header className="dash-head">
      <div><p className="eyebrow"><span className="ref">A1</span>Dashboard</p><h1>{doneCount === 0 ? "Let’s start your first lesson" : "Pick up where you left off"}</h1></div>
      <Link className="btn btn-lg" href={nextHref}>{doneCount === 0 ? "Start learning" : "Continue learning"} <Icon name="arrowRight" size={18} /></Link>
    </header>
    <section className="dash-summary" aria-label="Progress summary">
      <div className="dash-stat">
        <h2>Lessons completed</h2>
        <p className="dash-count num">{doneCount}<span>/ {total}</span></p>
        <div className="meter" role="progressbar" aria-label="Curriculum progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        <p className="dash-note">{pct}% of the curriculum · certificate unlocks at 100%</p>
      </div>
      <div className="dash-stat">
        <h2>First-try accuracy</h2>
        <div className="status-bar" aria-hidden="true">{legend.map((l) => <span key={l.key} style={{ flexGrow: l.n, background: l.color }} />)}{counts.good + counts.practice + counts.low === 0 && <span className="is-empty" />}</div>
        <ul className="dash-legend">{legend.map((l) => <li key={l.key}><i style={{ background: l.color }} aria-hidden="true" />{l.label}<b className="num">{l.n}</b></li>)}</ul>
      </div>
    </section>
    <section className="dash-block" aria-labelledby="modules-title">
      <div className="dash-block-head"><h2 id="modules-title">Modules</h2><span className="dash-sub">{modules.filter((m) => m.done >= m.total).length} of {modules.length} complete</span></div>
      <ol className="module-grid">{modules.map((module) => { const complete = module.done >= module.total; return <li key={module.slug}><Link className={`module-card${complete ? " is-done" : ""}`} href={`/modules/${module.slug}`}>
        <span className="module-top"><span className="module-num num" aria-hidden="true">{String(module.order).padStart(2, "0")}</span>{complete && <span className="module-check" aria-hidden="true"><Icon name="check" size={12} strokeWidth={2.75} /></span>}</span>
        <strong>{module.title}</strong>
        <span className="module-meta"><span className="num">{module.done}/{module.total}</span> lessons{complete && <span className="sr-only"> — complete</span>}</span>
        <span className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, module.done / module.total * 100)}%` }} /></span>
      </Link></li>; })}</ol>
    </section>
    {dashboardReady && <section className="dash-block" aria-label="Leaderboards"><div className="dash-leaderboards"><Leaderboards type="points" /><Leaderboards type="streak" /></div><ShareBonus signedIn={signedIn} /></section>}
    <section className="dash-block dash-soon" aria-label="Coming soon">
      <div><span className="badge">Soon</span><h2>Projects</h2><p>Practice on real datasets, end to end.</p></div>
      <div><span className="badge">Soon</span><h2>Daily challenge</h2><p>Scores and daily streaks will appear here.</p></div>
    </section>
    {signedIn && <footer className="dash-danger"><div><strong>Reset progress</strong><p>Clears completed lessons. Points and streak stay.</p></div><button className="btn btn-quiet btn-sm" onClick={() => setConfirm(true)}>Reset…</button></footer>}
    {message && <p role="status" className="dash-message">{message}</p>}
    {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(false); }} onKeyDown={(e) => { if (e.key === "Escape") setConfirm(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Reset lesson progress?</h2><p>Your completed lessons will be cleared. Points and streak will stay.</p><div className="modal-actions"><button className="btn btn-quiet" autoFocus onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-danger" onClick={() => void reset()}>Reset progress</button></div></section></div>}
  </main>;
}
