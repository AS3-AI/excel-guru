import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { getLesson, getOrder } from "@/lib/lessons";
import { MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  return <><SiteHeader signedIn={!!user} current="dashboard" /><main className="dashboard module-page wrap pt-s7 pb-s8
          [@media(max-width:720px)]:pt-s5" id="main">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><Icon name="chevronRight" size={14} /><span aria-current="page">{module.title}</span></nav>
    <header className="dash-head flex flex-wrap items-end justify-between gap-s5 mb-s6
          [&_h1]:m-0 [&_h1]:text-[clamp(1.9rem,_4.4vw,_2.75rem)] [&_h1]:tracking-[-0.03em]
          [&_.eyebrow]:mb-s3
          [@media(max-width:720px)]:[&_.btn]:w-full">
      <div>
        <p className="eyebrow"><span className="ref">M{module.order}</span>Module {module.order} of {MODULES.length}</p>
        <h1>{module.title}</h1>
        <div className="module-progress flex items-center gap-s3 mt-s4 text-muted text-ledger-sm
          [&_.meter]:w-[180px]
          [&_.num]:text-ink [&_.num]:font-semibold"><div className="meter" role="progressbar" aria-label="Module progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div><span className="num">{done}/{lessons.length}</span> lessons completed</div>
      </div>
      {next && <Link className="btn btn-lg" href={`/lesson/${next.id}`}>{done === 0 ? "Start module" : done >= lessons.length ? "Review module" : "Continue"} <Icon name="arrowRight" size={18} /></Link>}
    </header>
    {lessons.length === 0 ? <p className="dash-empty p-s6 [border:1px_dashed_var(--border-strong)] rounded-ledger-lg text-muted text-center">Lessons for this module are on their way.</p> : <ol className="lesson-rows list-none m-0 p-0 bg-surface [border:var(--line)] rounded-ledger-lg overflow-hidden [box-shadow:var(--shadow-2)]
          [&_li+li]:[border-top:1px_solid_var(--border)]
          [&_a]:grid [&_a]:grid-cols-[48px_22px_minmax(0,_1fr)_auto_18px] [&_a]:items-center [&_a]:gap-s4 [&_a]:min-h-[58px]
          [&_a]:p-[0_var(--s5)_0_0] [&_a]:text-text [&_a]:no-underline [&_a]:[transition:background-color_var(--d1)_var(--ease)]
          [&_a:hover]:bg-butter
          [&_a:focus-visible]:[outline-offset:-2px] [&_a:focus-visible]:rounded-[0]
          [&_a:hover_.lr-go]:text-primary [&_a:hover_.lr-go]:[transform:translateX(3px)]
          [@media(max-width:720px)]:[&_a]:grid-cols-[36px_20px_minmax(0,_1fr)_16px] [@media(max-width:720px)]:[&_a]:gap-s3
          [@media(max-width:720px)]:[&_a]:pr-s3">{lessons.map((lesson, i) => { const isDone = completed.has(lesson.id); return <li key={lesson.id}><Link href={`/lesson/${lesson.id}`} className={isDone ? "is-done" : undefined}>
      <span className="lr-num num [align-self:stretch] grid place-items-center bg-surface-sunk [border-right:2px_solid_var(--ink)] text-muted
          text-ledger-xs" aria-hidden="true">{i + 1}</span>
      <span className="lr-status grid place-items-center w-[20px] h-[20px] rounded-[50%] [border:2px_solid_var(--ink)]
          [.is-done_&]:bg-primary [.is-done_&]:border-ink [.is-done_&]:text-primary-ink" aria-hidden="true">{isDone ? <Icon name="check" size={13} strokeWidth={2.75} /> : null}</span>
      <span className="lr-title text-ink font-medium">{lesson.title}<span className="sr-only">{isDone ? " — complete" : " — not started"}</span></span>
      <span className="lr-meta text-muted text-[0.78rem] [font-family:var(--mono)]
          [@media(max-width:720px)]:hidden">{isDone ? badges.get(lesson.id) ?? "Complete" : ""}</span>
      <Icon name="chevronRight" size={16} className="lr-go text-faint [transition:transform_var(--d2)_var(--ease),_color_var(--d2)]" />
    </Link></li>; })}</ol>}
  </main><SiteFooter /></>;
}
