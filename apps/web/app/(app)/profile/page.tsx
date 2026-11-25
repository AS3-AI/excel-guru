import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrder, getLesson } from "@/lib/lessons";
import { nextRecommendedPath } from "@/lib/modules";
import { getIstDate, getIstDayUtcBounds } from "@/lib/progress";
import { currentStreakForOffset, safeLinkedInUrl, streakCopy } from "@/lib/leaderboard";
import { paymentsEnabled } from "@/lib/payments-config";
import {
  buildRecentActivity,
  computeAccuracySummary,
  computeLeagueTier,
  computeModuleBreakdown,
  computeWeeklyActivity,
  type LessonMeta,
} from "@/lib/profile-stats";
import { ProfileClient, type Milestone } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile & Learning Stats — Excel Guru",
  description: "Track your formula accuracy, daily streaks, leaderboard standing, and certificate progress.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

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
        <main className="wrap profile-page pt-s6 pb-s9 max-w-[1120px] m-[0_auto]" id="main">
          <h1>Profile unavailable</h1>
          <p>Database connection is temporarily unavailable. Please try again in a few moments.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const order = getOrder();
  const totalLessons = order.length;
  const lessonsById = new Map<string, LessonMeta>();
  for (const id of order) {
    const l = getLesson(id);
    if (l) {
      lessonsById.set(id, { id: l.id, title: l.title, module: l.module });
    }
  }

  const now = new Date();
  const todayIst = getIstDate(now);
  const todayBounds = getIstDayUtcBounds(now);

  // Parallel fetch profile, progress, streaks, points, leaderboards, subscriptions, certificates
  const [profileRes, progressRes, streakRes, pointsRes, pointsRankRes, streakRankRes, subRes, certRes] =
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
      admin.from("subscriptions").select("status,plan,period_end,provider").eq("user_id", user.id),
      admin.from("certificates").select("credential_id,name,issued_at").eq("user_id", user.id).maybeSingle(),
    ]);

  const profile = profileRes.data ?? {
    first_name: user.user_metadata?.first_name ?? user.email?.split("@")[0] ?? "Learner",
    username: user.user_metadata?.username ?? "learner",
    email: user.email ?? null,
    is_premium: false,
    invited: false,
    group_id: null,
    plan: null,
    linkedin_url: null,
    shared_on_linkedin: false,
    created_at: new Date().toISOString(),
  };

  let isGroupPaid = false;
  let groupName: string | null = null;
  if (profile.group_id) {
    const { data: groupData } = await admin
      .from("groups")
      .select("name,has_paid_access")
      .eq("id", profile.group_id)
      .maybeSingle();
    isGroupPaid = groupData?.has_paid_access === true;
    groupName = groupData?.name ?? null;
  }

  const subscriptions = subRes.data ?? [];
  const activeSub = subscriptions.find(
    (s) => s.status === "active" && (!s.period_end || Date.parse(s.period_end) > Date.now()),
  );
  const isInvited = profile.invited === true;
  const hasFullAccess = profile.is_premium === true || isInvited || isGroupPaid || !!activeSub;
  const billingEnabled = paymentsEnabled(process.env.PAYMENTS_ENABLED);
  const canCancel = !!activeSub && activeSub.provider === "razorpay" && billingEnabled;

  const progressRows = progressRes.data ?? [];
  const completedIds = progressRows.map((r) => r.lesson_id);
  const completedCount = completedIds.length;
  const progressPct = totalLessons > 0 ? Math.min(100, Math.round((completedCount / totalLessons) * 100)) : 0;

  // Honest accuracy & learning rate
  const accuracy = computeAccuracySummary(progressRows);

  // Streak calculations
  const rawStreak = streakRes.data?.current ?? 0;
  const longestStreak = Math.max(streakRes.data?.longest ?? 0, rawStreak);
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

  // XP-based League Tier
  const leagueTier = computeLeagueTier(totalPoints);

  // Leaderboard ranks
  const pointsRank = pointsRankRes.data?.rank ?? null;
  const streakRank = streakRankRes.data?.rank ?? null;

  // Module breakdown (matched cleanly by mod.slug)
  const moduleBreakdown = computeModuleBreakdown(order, lessonsById, completedIds);

  // Weekly 7-day activity & recent lessons
  const weeklyActivity = computeWeeklyActivity(pointsRows, now);
  const recentLessons = buildRecentActivity(progressRows, lessonsById, 5);
  const nextRecommendedHref = nextRecommendedPath(order, completedIds);

  // Milestones
  const milestones: Milestone[] = [
    {
      title: "First Formula",
      desc: "Completed your first interactive lesson",
      unlocked: completedCount >= 1,
      progressLabel: `${Math.min(completedCount, 1)} / 1`,
      icon: "play",
    },
    {
      title: "Sharp Shooter",
      desc: "100% first-try accuracy on 3+ lessons",
      unlocked: accuracy.perfectCount >= 3,
      progressLabel: `${Math.min(accuracy.perfectCount, 3)} / 3`,
      icon: "target",
    },
    {
      title: "Daily Flow",
      desc: "Maintained a 3-day learning streak",
      unlocked: currentStreak >= 3 || longestStreak >= 3,
      progressLabel: `${Math.min(Math.max(currentStreak, longestStreak), 3)} / 3d`,
      icon: "flame",
    },
    {
      title: "Point Collector",
      desc: "Earned 500+ points on the platform",
      unlocked: totalPoints >= 500,
      progressLabel: `${Math.min(totalPoints, 500)} / 500`,
      icon: "zap",
    },
    {
      title: "Formula Veteran",
      desc: "Completed 20+ lessons in curriculum",
      unlocked: completedCount >= 20,
      progressLabel: `${Math.min(completedCount, 20)} / 20`,
      icon: "award",
    },
    {
      title: "Excel Guru Master",
      desc: `Completed all ${totalLessons} curriculum lessons`,
      unlocked: completedCount >= totalLessons,
      progressLabel: `${completedCount} / ${totalLessons}`,
      icon: "trophy",
    },
  ];

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Member";

  const certificate = certRes.data
    ? {
        credentialId: certRes.data.credential_id,
        name: certRes.data.name,
        issuedAt: certRes.data.issued_at,
      }
    : null;

  return (
    <>
      <SiteHeader signedIn current="profile" />
      <main className="wrap profile-page pt-s6 pb-s9 max-w-[1120px] m-[0_auto]" id="main">
        <ProfileClient
          initialFirstName={profile.first_name}
          username={profile.username}
          email={profile.email}
          initialLinkedInUrl={safeLinkedInUrl(profile.linkedin_url)}
          sharedOnLinkedIn={profile.shared_on_linkedin === true}
          hasFullAccess={hasFullAccess}
          isInvited={isInvited}
          isGroupPaid={isGroupPaid}
          groupName={groupName}
          canCancel={canCancel}
          paymentsEnabled={billingEnabled}
          plan={profile.plan ?? activeSub?.plan ?? null}
          periodEnd={activeSub?.period_end ?? null}
          joinedDate={joinedDate}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          streakMessage={streakMessage}
          totalPoints={totalPoints}
          todayPoints={todayPoints}
          pointsRank={pointsRank}
          streakRank={streakRank}
          completedCount={completedCount}
          totalLessons={totalLessons}
          progressPct={progressPct}
          hasAccuracyData={accuracy.hasData}
          averageAccuracy={accuracy.averagePct}
          perfectLessonsCount={accuracy.perfectCount}
          accuracyTier={accuracy.tier}
          leagueTier={leagueTier}
          moduleBreakdown={moduleBreakdown}
          weeklyActivity={weeklyActivity}
          recentLessons={recentLessons}
          nextRecommendedHref={nextRecommendedHref}
          milestones={milestones}
          initialCertificate={certificate}
        />
      </main>
      <SiteFooter />
    </>
  );
}
