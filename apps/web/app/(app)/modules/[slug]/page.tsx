import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { getLesson, getOrder } from "@/lib/lessons";
import { MODULES } from "@/lib/modules";
import { moduleMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import "../../dashboard/dashboard.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const module = MODULES.find((item) => item.slug === slug);
  return moduleMetadata(module ?? null);
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
  return <><TopNav signedIn={!!user} /><main className="dashboard wrap"><nav aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link> › <span>{module.title}</span></nav><h1>{module.title}</h1><p>{done}/{module.total} Lessons Completed</p><ol>{lessons.map((lesson) => <li key={lesson.id} style={{ padding: "12px 0", color: completed.has(lesson.id) ? "var(--text)" : "var(--muted)" }}><Link href={`/lesson/${lesson.id}`} style={{ color: "inherit" }}>{lesson.title}</Link>{completed.has(lesson.id) ? ` · Complete · ${badges.get(lesson.id) ?? ""}` : " · Incomplete"}</li>)}</ol></main></>;
}
