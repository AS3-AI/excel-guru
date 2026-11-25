import {
  plPageClasses,
} from "./player-styles";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLesson, getOrder, nextLessonId, stepSequence } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideAndRecordLessonOpen, decideLessonAccess, loadLessonAccess } from "@/lib/access";
import { DASHBOARD_HREF, moduleHref } from "@/lib/nav-links";
import { Logo } from "@/components/SiteChrome";
import { Icon } from "@/components/icons";
import { Player } from "./Player";
import type { LessonNavItem } from "./LessonList";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) return {};
  const title = lesson.title;
  const description = `Practice ${lesson.title} in Excel with interactive browser-based spreadsheet exercises, real-time formula evaluation, and instant grading.`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function LessonPage({ params }: Props) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
  let decision = decideLessonAccess({ lessonId: id, userId: user?.id ?? null, completedLessonIds: [] });
  let access: Awaited<ReturnType<typeof loadLessonAccess>> | null = null;
  if (user) {
    const admin = createAdminClient();
    if (!admin) throw new Error("Lesson access is temporarily unavailable");
    access = await loadLessonAccess(admin, user.id, id);
    decision = access.decision;
  }
  if (user) {
    const admin = createAdminClient();
    decision = await decideAndRecordLessonOpen({ admin, lessonId: id, userId: user.id, completedLessonIds: access!.completedLessonIds, openedLessonIds: access!.openedLessonIds, premium: access!.premium, groupPremium: access!.groupPremium });
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
  // Where the paywall would start (2nd lesson done), invited learners see a "no payment needed" note instead.
  const inviteNotice = !!access?.invited && access.completedLessonIds.length === 1 && !access.completedLessonIds.includes(id);
  const completionById = new Map(completedRows.map((row) => [row.lesson_id, row]));
  const lessons: LessonNavItem[] = getOrder().flatMap((lessonId) => {
    const item = getLesson(lessonId);
    const completion = completionById.get(lessonId);
    return item ? [{ id: item.id, title: item.title, ...(completion ? { lastCompletedAt: completion.completed_at, firstTryAccuracy: completion.first_try_accuracy ?? 0 } : {}) }] : [];
  });

  return (
    <div className={`wrap pl-page ${plPageClasses}`}>
      <header className="pl-top flex items-center gap-s5 min-h-[60px] mb-s5 [border-bottom:1px_solid_var(--border)]
          [@media(max-width:640px)]:gap-s3 [@media(max-width:640px)]:mb-s4 [@media(max-width:640px)]:flex-wrap
          [@media(max-width:640px)]:p-[var(--s2)_0]"><Logo /><nav className="pl-breadcrumb flex items-center gap-[6px] min-w-0 text-muted text-ledger-sm pl-s5 [border-left:1px_solid_var(--border)]
          [@media(max-width:640px)]:pl-0 [@media(max-width:640px)]:[border-left:0]
          [@media(max-width:640px)]:[flex-basis:100%]
          [&_a]:text-muted [&_a]:no-underline [&_a]:whitespace-nowrap
          [&_a:hover]:text-ink [&_a:hover]:underline
          [&_svg]:[flex:none] [&_svg]:text-faint
          [&_[aria-current]]:text-ink [&_[aria-current]]:font-medium [&_[aria-current]]:overflow-hidden
          [&_[aria-current]]:[text-overflow:ellipsis] [&_[aria-current]]:whitespace-nowrap" aria-label="Breadcrumb"><Link href={DASHBOARD_HREF}>Dashboard</Link><Icon name="chevronRight" size={14} /><Link href={moduleHref(lesson.module)}>{lesson.module}</Link><Icon name="chevronRight" size={14} /><span aria-current="page">{lesson.title}</span></nav></header>
      <Player lesson={lesson} next={stepSequence(lesson.steps.length)} nextLessonId={nextLessonId(id)} lessons={lessons} signedOutIntro={!user && id === "intro"} signedIn={!!user} inviteNotice={inviteNotice} />
    </div>
  );
}
