import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { getLesson, getOrder } from "@/lib/lessons";
import { MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import "../../dashboard/dashboard.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const module = MODULES.find((item) => item.slug === slug);
  if (!module) return {};
  const title = `${module.title} Excel Lessons`;
  const description = `Master Excel ${module.title} functions and techniques with ${module.total} interactive hands-on lessons with real spreadsheet practice.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const module = MODULES.find((item) => item.slug === slug);
  if (!module) notFound();
  const lessons = getOrder().flatMap((id) => { const lesson = getLesson(id); return lesson?.module.toLowerCase() === module.title.toLowerCase() ? [lesson] : []; });
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let completed = new Set<string>();
  const badges = new Map<string, string>();
  if (user) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("lesson_progress").select("lesson_id,completed_at,first_try_accuracy").eq("user_id", user.id);
      completed = new Set((data ?? []).map((row) => row.lesson_id));
      for (const row of data ?? []) badges.set(row.lesson_id, `${new Date(row.completed_at).toLocaleDateString()} · ${Math.round((row.first_try_accuracy ?? 0) * 100)}% first try`);
    }
  }
  const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const next = lessons.find((lesson) => !completed.has(lesson.id)) ?? lessons[0];
  const pct = Math.round(done / Math.max(1, lessons.length) * 100);
  return <><SiteHeader signedIn={!!user} current="dashboard" /><main className="dashboard module-page wrap" id="main">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><Icon name="chevronRight" size={14} /><span aria-current="page">{module.title}</span></nav>
    <header className="dash-head">
      <div>
        <p className="eyebrow"><span className="ref">M{module.order}</span>Module {module.order} of {MODULES.length}</p>
        <h1>{module.title}</h1>
        <div className="module-progress"><div className="meter" role="progressbar" aria-label="Module progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div><span className="num">{done}/{lessons.length}</span> lessons completed</div>
      </div>
      {next && <Link className="btn btn-lg" href={`/lesson/${next.id}`}>{done === 0 ? "Start module" : done >= lessons.length ? "Review module" : "Continue"} <Icon name="arrowRight" size={18} /></Link>}
    </header>
    {lessons.length === 0 ? <p className="dash-empty">Lessons for this module are on their way.</p> : <ol className="lesson-rows">{lessons.map((lesson, i) => { const isDone = completed.has(lesson.id); return <li key={lesson.id}><Link href={`/lesson/${lesson.id}`} className={isDone ? "is-done" : undefined}>
      <span className="lr-num num" aria-hidden="true">{i + 1}</span>
      <span className="lr-status" aria-hidden="true">{isDone ? <Icon name="check" size={13} strokeWidth={2.75} /> : null}</span>
      <span className="lr-title">{lesson.title}<span className="sr-only">{isDone ? " — complete" : " — not started"}</span></span>
      <span className="lr-meta">{isDone ? badges.get(lesson.id) ?? "Complete" : ""}</span>
      <Icon name="chevronRight" size={16} className="lr-go" />
    </Link></li>; })}</ol>}
  </main><SiteFooter /></>;
}
