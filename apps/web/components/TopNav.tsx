"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, nextRecommendedPath, statusCounts, type StatusTag } from "@/lib/modules";
import { mergeLocalProgress, readLocalProgress } from "@/lib/local-progress";
import { Leaderboards } from "@/components/Leaderboards";
import { ShareBonus } from "@/components/ShareBonus";

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
  return <main className="dashboard wrap"><h1>Your learning dashboard</h1><section className="dash-total"><h2>Total Lessons Completed</h2><p className="dash-count">{doneCount} / 85</p><div className="status-bar" aria-label={`Low Accuracy ${counts.low}, Needs Practice ${counts.practice}, Good ${counts.good}`}><span style={{ width: `${counts.low / 85 * 100}%`, background: "var(--danger)" }} /><span style={{ width: `${counts.practice / 85 * 100}%`, background: "var(--warning)" }} /><span style={{ width: `${counts.good / 85 * 100}%`, background: "var(--primary)" }} /></div><p>Certificate available when all lessons are done.</p></section><section className="dash-next"><h2>Next Recommended Lesson</h2><Link className="btn" href={signedIn ? recommendedPath : nextRecommendedPath(order, done)}>Continue learning →</Link></section>{dashboardReady && <><div className="dash-leaderboards"><Leaderboards type="points" /><Leaderboards type="streak" /></div><ShareBonus signedIn={signedIn} /></>}<section><h2>Projects <small>Phase 3</small></h2><p>Project practice is coming soon.</p></section><section><h2>Modules</h2><div className="module-grid">{modules.map((module) => <Link className="module-card" href={`/modules/${module.slug}`} key={module.slug}><strong>{module.title}</strong><span>{module.done}/{module.total} Lessons Completed</span><span className="module-track"><i style={{ width: `${Math.min(100, module.done / module.total * 100)}%` }} /></span></Link>)}</div></section><section><h2>Daily challenge <small>Phase 3</small></h2><p>Scores and daily streaks will appear here.</p></section>{signedIn && <p><button className="text-button" onClick={() => setConfirm(true)}>Reset Progress</button></p>}{message && <p role="status">{message}</p>}{confirm && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">Reset lesson progress?</h2><p>Your completed lessons will be cleared. Points and streak will stay.</p><div><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn danger-button" onClick={() => void reset()}>Reset progress</button></div></section></div>}</main>;
}

export function TopNav({ signedIn = false }: { signedIn?: boolean }) {
  const linkStyle = { textDecoration: "none", color: "var(--text)" };
  return <header className="top-nav" style={{ display: "flex", alignItems: "center", gap: 20, maxWidth: 1200, margin: "auto", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}><Link className="top-brand" href="/" style={{ ...linkStyle, fontWeight: 800, color: "var(--ink)" }}>Excel Guru</Link><nav aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, flexWrap: "wrap" }}><Link href="/dashboard" style={linkStyle}>Dashboard</Link><Link href="/review" style={linkStyle}>Review</Link><Link href="/blog" style={linkStyle}>Blog</Link><details><summary>Excel ▾</summary><Link href="/dashboard" style={linkStyle}>Excel</Link><span>SQL · coming soon</span></details></nav>{signedIn ? <details className="account-menu"><summary>Account ▾</summary><Link href="/profile" style={linkStyle}>Profile</Link><Link href="/help" style={linkStyle}>Get help</Link><form action="/auth/signout" method="post"><button type="submit" style={{ border: 0, padding: 0, background: "none", color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer" }}>Log out</button></form></details> : <div className="nav-auth" style={{ display: "flex", gap: 14 }}><Link href="/login" style={linkStyle}>Log in</Link><Link href="/signup" style={linkStyle}>Sign up</Link></div>}</header>;
}
