import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrder, getLesson } from "@/lib/lessons";
import { MODULES } from "@/lib/modules";
import { getIstDate, getIstDayUtcBounds } from "@/lib/progress";
import { currentStreakForOffset, streakCopy } from "@/lib/leaderboard";
import { ProfileClient, type Milestone, type ModuleProgress } from "./ProfileClient";
import "./profile.css";

export const metadata: Metadata = {
  title: "Profile & Learning Stats — Excel Guru",
  description: "Track your formula accuracy, daily streaks, leaderboard standing, and certificate progress.",
  robots: { index: false },
};

export default async function ProfilePage() {
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  if (!user) redirect("/login?next=/profile");

  const admin = createAdminClient();
  if (!admin) {
    return (
      <>
        <SiteHeader signedIn current="profile" />
        <main className="wrap profile-page" id="main">
          <h1>Profile unavailable</h1>
          <p>Database connection is temporarily unavailable. Please try again in a few moments.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const order = getOrder();
  const totalLessons = order.length;
  const lessonModules = Object.fromEntries(
    order.flatMap((id) => {
      const l = getLesson(id);
      return l ? [[id, l.module.toLowerCase()]] : [];
    }),
  );

  const now = new Date();
  const todayIst = getIstDate(now);
  const todayBounds = getIstDayUtcBounds(now);

  // Parallel fetch profile, progress, streaks, points, leaderboards, subscription
  const [profileRes, progressRes, streakRes, pointsRes, pointsRankRes, streakRankRes, subRes] =
    await Promise.all([
      admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      admin
        .from("lesson_progress")
        .select("lesson_id,completed_at,first_try_accuracy,times_completed")
        .eq("user_id", user.id),
      admin.from("streaks").select("current,longest,last_active_date").eq("user_id", user.id).maybeSingle(),
      admin.from("points_log").select("points,created_at").eq("user_id", user.id),
      admin.from("leaderboard_points_today").select("rank,points").eq("user_id", user.id).maybeSingle(),
      admin.from("leaderboard_streaks_today").select("rank,streak").eq("user_id", user.id).maybeSingle(),
      admin.from("subscriptions").select("status,plan,period_end").eq("user_id", user.id).maybeSingle(),
    ]);

  const profile = profileRes.data ?? {
    first_name: user.user_metadata?.first_name ?? user.email?.split("@")[0] ?? "Learner",
    username: user.user_metadata?.username ?? "learner",
    email: user.email ?? null,
    is_premium: false,
    plan: null,
    linkedin_url: null,
    shared_on_linkedin: false,
    created_at: new Date().toISOString(),
  };

  const progressRows = progressRes.data ?? [];
  const completedIds = progressRows.map((r) => r.lesson_id);
  const completedCount = completedIds.length;
  const progressPct = Math.min(100, Math.round((completedCount / totalLessons) * 100));

  // Learning Rate / First-Try Accuracy calculation
  const accuracies = progressRows
    .map((r) => r.first_try_accuracy)
    .filter((a): a is number => typeof a === "number");
  const averageAccuracy = accuracies.length
    ? Math.round((accuracies.reduce((sum, val) => sum + val, 0) / accuracies.length) * 100)
    : 100;

  const accuracyTier =
    averageAccuracy >= 90
      ? { label: "Mastery", desc: "Top-tier formula precision on first try" }
      : averageAccuracy >= 75
      ? { label: "Proficient", desc: "Strong retention with few formula syntax errors" }
      : averageAccuracy >= 50
      ? { label: "Practitioner", desc: "Steady progress across formula categories" }
      : { label: "Developing", desc: "Building formula intuition and muscle memory" };

  // Streak calculations
  const rawStreak = streakRes.data?.current ?? 0;
  const longestStreak = streakRes.data?.longest ?? rawStreak;
  const lastActiveDate = streakRes.data?.last_active_date;
  const yesterday = new Date(`${todayIst}T00:00:00+05:30`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayText = getIstDate(yesterday);
  const dayOffset = lastActiveDate === todayIst ? 0 : lastActiveDate === yesterdayText ? 1 : 2;
  const currentStreak = currentStreakForOffset(rawStreak, dayOffset);
  const streakMessage = streakCopy(currentStreak, dayOffset, true);

  // Points calculations
  const pointsRows = pointsRes.data ?? [];
  const totalPoints = pointsRows.reduce((sum, row) => sum + row.points, 0);
  const todayPoints = pointsRows
    .filter((r) => r.created_at >= todayBounds.start && r.created_at < todayBounds.end)
    .reduce((sum, row) => sum + row.points, 0);

  // Leaderboard ranks
  const pointsRank = pointsRankRes.data?.rank ?? null;
  const streakRank = streakRankRes.data?.rank ?? null;

  // Module breakdown
  const moduleBreakdown: ModuleProgress[] = MODULES.map((mod) => {
    const modLessonsDone = order.filter(
      (id) => lessonModules[id] === mod.title.toLowerCase() && completedIds.includes(id),
    ).length;
    return {
      title: mod.title,
      done: modLessonsDone,
      total: mod.total,
      pct: Math.min(100, Math.round((modLessonsDone / mod.total) * 100)),
    };
  });

  // Milestones
  const perfectLessonsCount = progressRows.filter((r) => (r.first_try_accuracy ?? 0) >= 0.99).length;
  const milestones: Milestone[] = [
    {
      title: "First Formula",
      desc: "Completed your first interactive lesson",
      unlocked: completedCount >= 1,
      icon: "play",
    },
    {
      title: "Sharp Shooter",
      desc: "100% first-try accuracy on 3+ lessons",
      unlocked: perfectLessonsCount >= 3,
      icon: "target",
    },
    {
      title: "Daily Flow",
      desc: "Maintained a 3-day learning streak",
      unlocked: currentStreak >= 3 || longestStreak >= 3,
      icon: "flame",
    },
    {
      title: "Point Collector",
      desc: "Earned 500+ points on the platform",
      unlocked: totalPoints >= 500,
      icon: "zap",
    },
    {
      title: "Formula Veteran",
      desc: "Completed 20+ lessons in curriculum",
      unlocked: completedCount >= 20,
      icon: "award",
    },
    {
      title: "Excel Guru Master",
      desc: "Completed all 86 curriculum lessons",
      unlocked: completedCount >= totalLessons,
      icon: "trophy",
    },
  ];

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "March 2024";

  return (
    <>
      <SiteHeader signedIn current="profile" />
      <main className="wrap profile-page" id="main">
        <ProfileClient
          initialFirstName={profile.first_name}
          username={profile.username}
          email={profile.email}
          initialLinkedInUrl={profile.linkedin_url}
          sharedOnLinkedIn={profile.shared_on_linkedin}
          isPremium={profile.is_premium}
          plan={profile.plan ?? subRes.data?.plan ?? null}
          periodEnd={subRes.data?.period_end ?? null}
          joinedDate={joinedDate}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          dayOffset={dayOffset}
          streakMessage={streakMessage}
          totalPoints={totalPoints}
          todayPoints={todayPoints}
          pointsRank={pointsRank}
          streakRank={streakRank}
          completedCount={completedCount}
          totalLessons={totalLessons}
          progressPct={progressPct}
          averageAccuracy={averageAccuracy}
          accuracyTier={accuracyTier}
          moduleBreakdown={moduleBreakdown}
          milestones={milestones}
        />
      </main>
      <SiteFooter />
    </>
  );
}
