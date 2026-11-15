import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLesson, getOrder, nextLessonId, stepSequence } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideLessonAccess, loadLessonAccess } from "@/lib/access";
import { Player } from "./Player";
import type { LessonNavItem } from "./LessonList";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = getLesson((await params).id);
  return { title: lesson ? `${lesson.title} — Excel Guru` : "Lesson not found — Excel Guru" };
}

export default async function LessonPage({ params }: Props) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let decision = decideLessonAccess({ lessonId: id, userId: user?.id ?? null, completedLessonIds: [] });
  if (user) {
    const admin = createAdminClient();
    if (!admin) throw new Error("Lesson access is temporarily unavailable");
    decision = (await loadLessonAccess(admin, user.id, id)).decision;
  }
  if (!decision.allowed) redirect(decision.reason === "signup" ? `/signup?next=${encodeURIComponent(`/lesson/${id}`)}` : "/pricing");
  let completedRows: { lesson_id: string; completed_at: string; first_try_accuracy: number | null }[] = [];
  if (user) {
    const admin = createAdminClient();
    if (admin) {
      const { data } = await admin.from("lesson_progress").select("lesson_id,completed_at,first_try_accuracy").eq("user_id", user.id);
      completedRows = data ?? [];
    }
  }
  const completionById = new Map(completedRows.map((row) => [row.lesson_id, row]));
  const lessons: LessonNavItem[] = getOrder().flatMap((lessonId) => {
    const item = getLesson(lessonId);
    const completion = completionById.get(lessonId);
    return item ? [{ id: item.id, title: item.title, ...(completion ? { lastCompletedAt: completion.completed_at, firstTryAccuracy: completion.first_try_accuracy ?? 0 } : {}) }] : [];
  });

  return (
    <div className="wrap pl-page">
      <nav className="pl-breadcrumb"><Link href="/">Dashboard</Link><span>›</span><span>{lesson.module}</span><span>›</span><strong>{lesson.title}</strong></nav>
      <Player lesson={lesson} next={stepSequence(lesson.steps.length)} nextLessonId={nextLessonId(id)} lessons={lessons} signedOutIntro={!user && id === "intro"} signedIn={!!user} />
    </div>
  );
}
