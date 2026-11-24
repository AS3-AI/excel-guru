import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrder, getLesson } from "@/lib/lessons";
import { MODULES } from "@/lib/modules";
import { getIstDate, getIstDayUtcBounds } from "@/lib/progress";
import { currentStreakForOffset, streakCopy } from "@/lib/leaderboard";
import { Leaderboards } from "@/components/Leaderboards";
import { Icon } from "@/components/icons";
import { ProfileClient } from "./ProfileClient";
import "./profile.css";

export const metadata: Metadata = {
  title: "Profile & Learning Stats — Excel Guru",
  description: "Track your formula accuracy, daily streaks, leaderboard standing, and certificate progress.",
  robots: { index: false },
};

export default async function ProfilePage() {
  const session = await createClient();
  const { data: { user } } = session ? await session.auth.getUser() : { data: { user: null } };
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
  const [profileRes, progressRes, streakRes, pointsRes, pointsRankRes, streakRankRes, subRes] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("lesson_progress").select("lesson_id,completed_at,first_try_accuracy,times_completed").eq("user_id", user.id),
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
  const moduleBreakdown = MODULES.map((mod) => {
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
  const milestones = [
    {
      title: "First Formula",
      desc: "Completed your first interactive lesson",
      unlocked: completedCount >= 1,
      icon: "play" as const,
    },
    {
      title: "Sharp Shooter",
      desc: "100% first-try accuracy on 3+ lessons",
      unlocked: perfectLessonsCount >= 3,
      icon: "target" as const,
    },
    {
      title: "Daily Flow",
      desc: "Maintained a 3-day learning streak",
      unlocked: currentStreak >= 3 || longestStreak >= 3,
      icon: "flame" as const,
    },
    {
      title: "Point Collector",
      desc: "Earned 500+ points on the platform",
      unlocked: totalPoints >= 500,
      icon: "zap" as const,
    },
    {
      title: "Formula Veteran",
      desc: "Completed 20+ lessons in curriculum",
      unlocked: completedCount >= 20,
      icon: "award" as const,
    },
    {
      title: "Excel Guru Master",
      desc: "Completed all 86 curriculum lessons",
      unlocked: completedCount >= totalLessons,
      icon: "trophy" as const,
    },
  ];

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Recently";

  const isPro = profile.is_premium;

  return (
    <>
      <SiteHeader signedIn current="profile" />
      <main className="wrap profile-page" id="main">
        {/* Profile Header Hero Banner */}
        <section className="profile-header-card" aria-label="Learner overview">
          <div className="profile-user-info">
            <div className="profile-avatar" aria-hidden="true">
              {profile.first_name ? profile.first_name.charAt(0) : "G"}
            </div>
            <div className="profile-details">
              <h1>Hey, {profile.first_name}</h1>
              <div className="profile-meta-row">
                <span className="profile-handle">@{profile.username}</span>
                {profile.email && <span>{profile.email}</span>}
                <span>Member since {joinedDate}</span>
                <span className={`profile-badge ${isPro ? "is-pro" : "is-free"}`}>
                  {isPro ? "PRO Member" : "Free Plan"}
                </span>
              </div>
            </div>
          </div>
          <div className="profile-header-actions">
            <Link className="btn btn-quiet" href="/dashboard">
              <Icon name="grid" size={16} /> Dashboard
            </Link>
            <Link className="btn" href={completedCount === 0 ? "/lesson/intro" : "/dashboard"}>
              Continue Learning <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </section>

        {/* 4-Stat Metrics Grid */}
        <section className="profile-metrics-grid" aria-label="Learning statistics">
          {/* Learning Rate / First-Try Accuracy */}
          <div className="metric-card accent-mint">
            <div className="metric-head">
              <h2>Learning Rate</h2>
              <span className="metric-icon"><Icon name="target" size={16} /></span>
            </div>
            <p className="metric-value">{averageAccuracy}<span>%</span></p>
            <div className="metric-footer">
              <span className="metric-tag">{accuracyTier.label}</span>
              <span>1st-try accuracy</span>
            </div>
          </div>

          {/* Lessons Completed */}
          <div className="metric-card">
            <div className="metric-head">
              <h2>Lessons Done</h2>
              <span className="metric-icon"><Icon name="check" size={16} /></span>
            </div>
            <p className="metric-value">{completedCount}<span>/ {totalLessons}</span></p>
            <div className="metric-footer">
              <span className="meter" style={{ flex: 1, height: 8 }} aria-hidden="true">
                <i style={{ width: `${progressPct}%` }} />
              </span>
              <span>{progressPct}%</span>
            </div>
          </div>

          {/* Current Streak */}
          <div className="metric-card accent-butter">
            <div className="metric-head">
              <h2>Daily Streak</h2>
              <span className="metric-icon"><Icon name="flame" size={16} /></span>
            </div>
            <p className="metric-value">{currentStreak}<span>{currentStreak === 1 ? "day" : "days"}</span></p>
            <div className="metric-footer">
              <span className="metric-tag">Best: {longestStreak}d</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                {dayOffset === 0 ? "Extended today" : "Needs activity"}
              </span>
            </div>
          </div>

          {/* Total Points */}
          <div className="metric-card">
            <div className="metric-head">
              <h2>Total Points</h2>
              <span className="metric-icon"><Icon name="zap" size={16} /></span>
            </div>
            <p className="metric-value">{totalPoints}<span>pts</span></p>
            <div className="metric-footer">
              <span className="metric-tag" style={{ color: "var(--primary)" }}>+{todayPoints} today</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>IST timezone</span>
            </div>
          </div>
        </section>

        {/* Two-Column Detail Layout */}
        <div className="profile-content-layout">
          {/* Main Column */}
          <div className="profile-column">
            {/* Today's Leaderboard Standings Card */}
            <section className="profile-card" aria-labelledby="leaderboard-heading">
              <div className="profile-card-header">
                <h2 id="leaderboard-heading"><Icon name="trophy" size={20} />Today&apos;s Leaderboard Standing</h2>
                <Link className="btn btn-quiet" style={{ fontSize: "var(--fs-xs)", padding: "4px 8px" }} href="/dashboard">
                  Live Board →
                </Link>
              </div>

              <div className="lb-status-grid">
                <div className="lb-status-box">
                  <h3>Points Rank Today</h3>
                  <div className={`lb-status-rank ${pointsRank && pointsRank <= 3 ? "is-top" : ""}`}>
                    {pointsRank ? `#${pointsRank}` : "Unranked"}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                    {todayPoints > 0 ? `${todayPoints} pts earned today` : "Complete a lesson today to enter"}
                  </p>
                </div>
                <div className="lb-status-box">
                  <h3>Streak Rank Today</h3>
                  <div className={`lb-status-rank ${streakRank && streakRank <= 3 ? "is-top" : ""}`}>
                    {streakRank ? `#${streakRank}` : "Unranked"}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                    {currentStreak > 0 ? `${currentStreak} day active streak` : streakMessage}
                  </p>
                </div>
              </div>

              {/* Embed Live Leaderboard Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--s4)" }}>
                <Leaderboards type="points" />
                <Leaderboards type="streak" />
              </div>
            </section>

            {/* Curriculum & Track Mastery Breakdown */}
            <section className="profile-card" aria-labelledby="curriculum-heading">
              <div className="profile-card-header">
                <h2 id="curriculum-heading"><Icon name="grid" size={20} />Curriculum Mastery by Module</h2>
                <p>{moduleBreakdown.filter((m) => m.done >= m.total).length} of {moduleBreakdown.length} complete</p>
              </div>

              <div className="mastery-module-list">
                {moduleBreakdown.map((mod) => (
                  <div key={mod.title} className="mastery-module-item">
                    <div className="mastery-module-head">
                      <strong>{mod.title}</strong>
                      <span>{mod.done} / {mod.total} ({mod.pct}%)</span>
                    </div>
                    <div className="meter" style={{ height: 6 }} aria-hidden="true">
                      <i style={{ width: `${mod.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Achievements & Milestones */}
            <section className="profile-card" aria-labelledby="achievements-heading">
              <div className="profile-card-header">
                <h2 id="achievements-heading"><Icon name="sparkle" size={20} />Achievements &amp; Badges</h2>
                <p>{milestones.filter((m) => m.unlocked).length} of {milestones.length} unlocked</p>
              </div>

              <div className="badges-grid">
                {milestones.map((b) => (
                  <div key={b.title} className={`badge-item ${b.unlocked ? "is-unlocked" : ""}`}>
                    <div className="badge-icon-box">
                      <Icon name={b.icon} size={22} />
                    </div>
                    <strong>{b.title}</strong>
                    <small>{b.desc}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Side Column: Certificate, Profile Form, Subscription, Danger Zone */}
          <div className="profile-column">
            {/* Certificate Preview Card */}
            <section className="profile-card" aria-labelledby="cert-heading">
              <div className="profile-card-header">
                <h2 id="cert-heading"><Icon name="award" size={20} />Verified Certificate</h2>
                <span className="badge">{isPro && completedCount >= totalLessons ? "Ready" : "In Progress"}</span>
              </div>

              <div className={`certificate-preview-box ${isPro && completedCount >= totalLessons ? "is-unlocked" : ""}`}>
                <div className="cert-seal">
                  <Icon name="award" size={26} />
                </div>
                <h3>Excel Formula Mastery</h3>
                <p>
                  Official credential awarded to verified learners upon 100% curriculum completion.
                </p>

                {isPro && completedCount >= totalLessons ? (
                  <button className="btn btn-lg" style={{ width: "100%" }}>
                    <Icon name="download" size={16} /> Download Certificate
                  </button>
                ) : (
                  <div>
                    <div className="meter" style={{ height: 8, marginBottom: 8 }} aria-hidden="true">
                      <i style={{ width: `${progressPct}%` }} />
                    </div>
                    <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                      {completedCount} / {totalLessons} lessons finished ({progressPct}%). Complete all 86 lessons with PRO to unlock.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Interactive Client Form (LinkedIn URL, Profile Name, Share Bonus, Billing, Reset) */}
            <ProfileClient
              initialFirstName={profile.first_name}
              username={profile.username}
              email={profile.email}
              initialLinkedInUrl={profile.linkedin_url}
              sharedOnLinkedIn={profile.shared_on_linkedin}
              isPremium={profile.is_premium}
              plan={profile.plan ?? subRes.data?.plan ?? null}
              periodEnd={subRes.data?.period_end ?? null}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
