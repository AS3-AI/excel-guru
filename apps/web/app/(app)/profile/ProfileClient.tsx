"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Leaderboards } from "@/components/Leaderboards";

export type Milestone = {
  title: string;
  desc: string;
  unlocked: boolean;
  icon: IconName;
};

export type ModuleProgress = {
  title: string;
  done: number;
  total: number;
  pct: number;
};

export type ProfileClientProps = {
  initialFirstName: string;
  username: string;
  email: string | null;
  initialLinkedInUrl: string | null;
  sharedOnLinkedIn: boolean;
  isPremium: boolean;
  plan: string | null;
  periodEnd: string | null;
  joinedDate: string;
  // Learning stats
  currentStreak: number;
  longestStreak: number;
  dayOffset: number;
  streakMessage: string;
  totalPoints: number;
  todayPoints: number;
  pointsRank: number | null;
  streakRank: number | null;
  completedCount: number;
  totalLessons: number;
  progressPct: number;
  averageAccuracy: number;
  accuracyTier: { label: string; desc: string };
  moduleBreakdown: ModuleProgress[];
  milestones: Milestone[];
};

export function ProfileClient({
  initialFirstName,
  username,
  email,
  initialLinkedInUrl,
  sharedOnLinkedIn: initialShared,
  isPremium,
  plan,
  periodEnd,
  joinedDate,
  currentStreak,
  longestStreak,
  dayOffset: _dayOffset,
  streakMessage,
  totalPoints,
  todayPoints,
  pointsRank,
  streakRank,
  completedCount,
  totalLessons,
  progressPct,
  averageAccuracy,
  accuracyTier: _accuracyTier,
  moduleBreakdown,
  milestones,
}: ProfileClientProps) {
  const router = useRouter();

  // Profile fields state
  const [firstName, setFirstName] = useState(initialFirstName);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedInUrl ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Edit Profile Modal state (triggered by cover banner edit button)
  const [showEditModal, setShowEditModal] = useState(false);

  // Sidebar Tabbed Leaderboard state
  const [sidebarTab, setSidebarTab] = useState<"leaders" | "standings">("leaders");

  // Share bonus & copy link state
  const [shared, setShared] = useState(initialShared);
  const [claimingShare, setClaimingShare] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // View all achievements toggle
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  // Reset progress modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Cancel subscription state
  const [cancellingSub, setCancellingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<string | null>(null);
  const [activePeriodEnd, setActivePeriodEnd] = useState(periodEnd);

  // Formula Tier calculation
  const getLeagueTier = () => {
    if (totalPoints >= 3000 || averageAccuracy >= 95) {
      return { name: "Diamond", colorClass: "is-rank", desc: "Top tier formula prowess" };
    }
    if (totalPoints >= 1500 || averageAccuracy >= 85) {
      return { name: "Emerald", colorClass: "is-rank", desc: "Advanced formula mastery" };
    }
    if (totalPoints >= 500 || averageAccuracy >= 75) {
      return { name: "Gold", colorClass: "is-xp", desc: "Strong formula retention" };
    }
    if (totalPoints >= 200 || averageAccuracy >= 60) {
      return { name: "Silver", colorClass: "is-league", desc: "Consistent formula learner" };
    }
    return { name: "Bronze", colorClass: "is-league", desc: "Formula apprentice" };
  };

  const leagueTier = getLeagueTier();

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          linkedinUrl: linkedinUrl.trim() === "" ? null : linkedinUrl.trim(),
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setProfileMsg({ text: data.error ?? "Failed to update profile", ok: false });
      } else {
        setProfileMsg({ text: "Profile updated successfully!", ok: true });
        router.refresh();
        setTimeout(() => {
          setShowEditModal(false);
        }, 800);
      }
    } catch {
      setProfileMsg({ text: "Network error. Please try again.", ok: false });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleShareBonus = async () => {
    setClaimingShare(true);
    setShareMsg(null);

    const shareUrl = encodeURIComponent("https://excelguru.app");
    const text = encodeURIComponent("I'm learning Excel formulas interactively on Excel Guru! Real spreadsheet in the browser. 📊");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&summary=${text}`, "_blank", "width=600,height=600");

    try {
      const res = await fetch("/api/share-bonus", { method: "POST" });
      const data = (await res.json()) as { points?: number; error?: string };
      if (res.ok) {
        setShared(true);
        setShareMsg("+500 points awarded for sharing!");
        window.dispatchEvent(new Event("excelguru:share-bonus"));
        router.refresh();
      } else {
        setShareMsg(data.error ?? "Could not claim share bonus.");
      }
    } catch {
      setShareMsg("Could not claim share bonus.");
    } finally {
      setClaimingShare(false);
    }
  };

  const handleCopyProfileLink = async () => {
    try {
      const url = `${window.location.origin}/profile`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/progress/reset", { method: "POST" });
      if (res.ok) {
        setShowResetModal(false);
        router.refresh();
        window.location.reload();
      } else {
        alert("Failed to reset progress. Please try again.");
      }
    } catch {
      alert("Network error while resetting progress.");
    } finally {
      setResetting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will keep access until the end of your billing cycle.")) return;
    setCancellingSub(true);
    setSubMsg(null);
    try {
      const res = await fetch("/api/billing/manage", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; endsAt?: string | null; error?: string };
      if (res.ok && data.ok) {
        setSubMsg("Subscription scheduled to cancel at end of billing period.");
        if (data.endsAt) setActivePeriodEnd(data.endsAt);
        router.refresh();
      } else {
        setSubMsg(data.error ?? "Could not cancel subscription.");
      }
    } catch {
      setSubMsg("Network error.");
    } finally {
      setCancellingSub(false);
    }
  };

  // Avatar display character
  const avatarChar = firstName ? firstName.charAt(0).toUpperCase() : "G";

  return (
    <>
      {/* 1. TOP HERO COVER BANNER */}
      <section className="duo-hero-banner" aria-label="Profile cover banner">
        {/* Centered Retro Avatar */}
        <div className="duo-avatar-wrap">
          <div className="duo-avatar" aria-hidden="true">
            {avatarChar}
          </div>
        </div>

        {/* Edit Profile Modal Trigger Button in Top Right */}
        <button
          type="button"
          className="duo-edit-btn"
          aria-label="Edit Profile"
          title="Edit Profile"
          onClick={() => {
            setProfileMsg(null);
            setShowEditModal(true);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </section>

      {/* 2. IDENTITY ROW BELOW BANNER */}
      <section className="duo-identity-row" aria-label="User identification">
        <div className="identity-main">
          <h1 className="identity-name">{firstName}</h1>
          <p className="identity-handle">@{username}</p>
          <div className="identity-joined">
            <span>Joined {joinedDate}</span>
          </div>
          <div className="identity-social-links">
            <button
              type="button"
              className="social-stat-link"
              onClick={() => setSidebarTab("standings")}
              style={{ background: "none", border: "none", padding: 0 }}
            >
              3 Following
            </button>
            <button
              type="button"
              className="social-stat-link"
              onClick={() => setSidebarTab("leaders")}
              style={{ background: "none", border: "none", padding: 0 }}
            >
              12 Followers
            </button>
          </div>
        </div>

        {/* Course Track Badges on Right Side */}
        <div className="duo-track-badges" aria-label="Enrolled formula course tracks">
          <span className="track-badge-pill is-mint">fx SUM</span>
          <span className="track-badge-pill is-butter">XLOOKUP</span>
          <span className="track-badge-pill is-lilac">INDEX/MATCH</span>
          <span className="track-badge-pill is-sky">FILTER</span>
          <span className="track-badge-more">+11 more</span>
        </div>
      </section>

      {/* 3. TWO-COLUMN LAYOUT */}
      <div className="profile-content-layout">
        {/* LEFT / MAIN COLUMN */}
        <div className="profile-column">
          {/* STATISTICS 2x2 QUAD GRID */}
          <section className="duo-stats-section" aria-label="Learning statistics">
            <h2 className="duo-section-title">Statistics</h2>
            <div className="duo-stats-grid">
              {/* Stat 1: Day Streak */}
              <div className="stat-quad-card">
                <div className="stat-icon-box is-streak">
                  <Icon name="flame" size={24} />
                </div>
                <div className="stat-content">
                  <p className="stat-val">
                    {currentStreak}
                    <span>{currentStreak === 1 ? "day" : "days"}</span>
                  </p>
                  <p className="stat-label">Day streak</p>
                </div>
              </div>

              {/* Stat 2: Total XP / Points */}
              <div className="stat-quad-card">
                <div className="stat-icon-box is-xp">
                  <Icon name="zap" size={24} />
                </div>
                <div className="stat-content">
                  <p className="stat-val">
                    {totalPoints.toLocaleString()}
                    <span>pts</span>
                  </p>
                  <p className="stat-label">Total XP</p>
                </div>
              </div>

              {/* Stat 3: Formula Tier / Current League */}
              <div className="stat-quad-card">
                <div className={`stat-icon-box ${leagueTier.colorClass}`}>
                  <Icon name="award" size={24} />
                </div>
                <div className="stat-content">
                  <p className="stat-val">{leagueTier.name}</p>
                  <p className="stat-label">Current league</p>
                </div>
              </div>

              {/* Stat 4: Leaderboard Rank / Top Finishes */}
              <div className="stat-quad-card">
                <div className="stat-icon-box is-rank">
                  <Icon name="trophy" size={24} />
                </div>
                <div className="stat-content">
                  <p className="stat-val">{pointsRank ? `#${pointsRank}` : "1"}</p>
                  <p className="stat-label">{pointsRank ? "Leaderboard rank" : "Top 3 finishes"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. ACHIEVEMENTS SECTION */}
          <section className="duo-achievements-section" aria-label="Achievements and milestones">
            <div className="achievements-section-header">
              <h2>Achievements</h2>
              <button
                type="button"
                className="achievements-view-all"
                onClick={() => setShowAllAchievements(!showAllAchievements)}
              >
                {showAllAchievements ? "SHOW LESS" : "VIEW ALL"}
              </button>
            </div>

            <div className="achievements-list">
              {/* Achievement 1: Wildfire Streak */}
              <div className="duo-achievement-card">
                <div className="achievement-row-top">
                  <div className="achievement-icon-box is-butter">
                    <Icon name="flame" size={26} />
                  </div>
                  <div className="achievement-info">
                    <div className="achievement-title-row">
                      <h3 className="achievement-title">Wildfire</h3>
                      <span className="achievement-score">{Math.min(currentStreak, 7)} / 7</span>
                    </div>
                    <p className="achievement-desc">Reach a 7-day streak to ignite formula mastery habits</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap">
                  <div className="achievement-meter striped" aria-hidden="true">
                    <div
                      className="achievement-meter-fill"
                      style={{ width: `${Math.min(100, Math.round((currentStreak / 7) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 2: Formula Sniper Accuracy */}
              <div className="duo-achievement-card">
                <div className="achievement-row-top">
                  <div className="achievement-icon-box is-mint">
                    <Icon name="target" size={26} />
                  </div>
                  <div className="achievement-info">
                    <div className="achievement-title-row">
                      <h3 className="achievement-title">Formula Sniper</h3>
                      <span className="achievement-score">{averageAccuracy}% / 100%</span>
                    </div>
                    <p className="achievement-desc">Maintain high first-try precision on interactive formula tests</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap">
                  <div className="achievement-meter striped" aria-hidden="true">
                    <div
                      className="achievement-meter-fill"
                      style={{ width: `${averageAccuracy}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 3: Century Club Points */}
              <div className="duo-achievement-card">
                <div className="achievement-row-top">
                  <div className="achievement-icon-box is-rose">
                    <Icon name="zap" size={26} />
                  </div>
                  <div className="achievement-info">
                    <div className="achievement-title-row">
                      <h3 className="achievement-title">Century Club</h3>
                      <span className="achievement-score">
                        {Math.min(totalPoints, 1000).toLocaleString()} / 1,000
                      </span>
                    </div>
                    <p className="achievement-desc">Earn 1,000 total points solving spreadsheet challenges</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap">
                  <div className="achievement-meter striped" aria-hidden="true">
                    <div
                      className="achievement-meter-fill"
                      style={{ width: `${Math.min(100, Math.round((totalPoints / 1000) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 4: Grandmaster 86 Lessons */}
              <div className="duo-achievement-card">
                <div className="achievement-row-top">
                  <div className="achievement-icon-box is-lilac">
                    <Icon name="trophy" size={26} />
                  </div>
                  <div className="achievement-info">
                    <div className="achievement-title-row">
                      <h3 className="achievement-title">Grandmaster</h3>
                      <span className="achievement-score">
                        {completedCount} / {totalLessons}
                      </span>
                    </div>
                    <p className="achievement-desc">Complete all 86 interactive lessons across the full curriculum</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap">
                  <div className="achievement-meter striped" aria-hidden="true">
                    <div
                      className="achievement-meter-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Extra Unlocked Badges when VIEW ALL is open */}
              {showAllAchievements && (
                <div className="badges-grid" style={{ marginTop: "var(--s4)" }}>
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
              )}
            </div>
          </section>

          {/* Curriculum Mastery by Module */}
          <section className="profile-card" aria-labelledby="curriculum-heading">
            <div className="profile-card-header">
              <h2 id="curriculum-heading">
                <Icon name="grid" size={20} /> Curriculum Mastery by Module
              </h2>
              <p>
                {moduleBreakdown.filter((m) => m.done >= m.total).length} of {moduleBreakdown.length} complete
              </p>
            </div>

            <div className="mastery-module-list">
              {moduleBreakdown.map((mod) => (
                <div key={mod.title} className="mastery-module-item">
                  <div className="mastery-module-head">
                    <strong>{mod.title}</strong>
                    <span>
                      {mod.done} / {mod.total} ({mod.pct}%)
                    </span>
                  </div>
                  <div className="meter" style={{ height: 6 }} aria-hidden="true">
                    <i style={{ width: `${mod.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT-HAND SIDEBAR COLUMN */}
        <div className="profile-column">
          {/* SIDEBAR CARD 1: Tabbed Leaderboard card */}
          <section className="duo-tab-card" aria-label="Leaderboard standings">
            <div className="duo-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "leaders"}
                className={`duo-tab-btn ${sidebarTab === "leaders" ? "is-active" : ""}`}
                onClick={() => setSidebarTab("leaders")}
              >
                Today&apos;s Leaders
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "standings"}
                className={`duo-tab-btn ${sidebarTab === "standings" ? "is-active" : ""}`}
                onClick={() => setSidebarTab("standings")}
              >
                Your Standings
              </button>
            </div>

            <div style={{ padding: "var(--s4)" }}>
              {sidebarTab === "leaders" ? (
                <div>
                  <Leaderboards type="points" title="Top Scorers Today" />
                  <div style={{ marginTop: "var(--s3)", textAlign: "center" }}>
                    <Link
                      className="btn btn-quiet"
                      style={{ fontSize: "var(--fs-xs)", width: "100%" }}
                      href="/dashboard"
                    >
                      View Live Board on Dashboard →
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="lb-status-grid">
                    <div className="lb-status-box">
                      <h3>Points Rank</h3>
                      <div className={`lb-status-rank ${pointsRank && pointsRank <= 3 ? "is-top" : ""}`}>
                        {pointsRank ? `#${pointsRank}` : "Unranked"}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                        {todayPoints > 0 ? `+${todayPoints} pts today` : "Complete a lesson to enter"}
                      </p>
                    </div>
                    <div className="lb-status-box">
                      <h3>Streak Rank</h3>
                      <div className={`lb-status-rank ${streakRank && streakRank <= 3 ? "is-top" : ""}`}>
                        {streakRank ? `#${streakRank}` : "Unranked"}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                        {currentStreak > 0 ? `${currentStreak}d active streak` : streakMessage}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", marginTop: "var(--s2)" }}>
                    <span className="badge" style={{ fontSize: "var(--fs-xs)" }}>
                      League: {leagueTier.name} ({leagueTier.desc})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SIDEBAR CARD 2: Add Friends / Share on LinkedIn Bonus (+500 pts) */}
          <section className="add-friends-card" aria-label="Invite and share bonus">
            <h3>Add Friends &amp; Share</h3>
            <p style={{ margin: "0 0 var(--s4)", color: "var(--muted)", fontSize: "var(--fs-sm)" }}>
              Share your formula practice on LinkedIn to get 500 bonus points credited instantly toward today&apos;s leaderboard.
            </p>

            <div className="friend-action-list">
              {shared ? (
                <div className="friend-action-row" style={{ background: "var(--surface-sunk)", cursor: "default" }}>
                  <span className="friend-action-icon" style={{ background: "var(--mint)" }}>
                    <Icon name="check" size={18} />
                  </span>
                  <span className="friend-action-text">+500 pts claimed! Shared on LinkedIn</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="friend-action-row"
                  onClick={handleShareBonus}
                  disabled={claimingShare}
                >
                  <span className="friend-action-icon" style={{ background: "var(--butter)" }}>
                    <Icon name="externalLink" size={18} />
                  </span>
                  <span className="friend-action-text">
                    {claimingShare ? "Claiming bonus…" : "Share on LinkedIn (+500 pts)"}
                  </span>
                  <span className="friend-action-arrow">→</span>
                </button>
              )}

              <button
                type="button"
                className="friend-action-row"
                onClick={handleCopyProfileLink}
              >
                <span className="friend-action-icon">
                  <Icon name="user" size={18} />
                </span>
                <span className="friend-action-text">
                  {copiedLink ? "Profile link copied!" : "Invite Friends (Copy Link)"}
                </span>
                <span className="friend-action-arrow">→</span>
              </button>
            </div>

            {shareMsg && !shared && <p className="profile-feedback is-error">{shareMsg}</p>}
          </section>

          {/* SIDEBAR CARD 3: Verified Certificate preview card */}
          <section className="profile-card" aria-labelledby="cert-heading">
            <div className="profile-card-header">
              <h2 id="cert-heading">
                <Icon name="award" size={20} /> Verified Certificate
              </h2>
              <span className="badge">
                {isPremium && completedCount >= totalLessons ? "Ready" : "In Progress"}
              </span>
            </div>

            <div className={`certificate-preview-box ${isPremium && completedCount >= totalLessons ? "is-unlocked" : ""}`}>
              <div className="cert-seal">
                <Icon name="award" size={26} />
              </div>
              <h3>Excel Formula Mastery</h3>
              <p>
                Official credential awarded to verified learners upon 100% curriculum completion.
              </p>

              {isPremium && completedCount >= totalLessons ? (
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

          {/* SIDEBAR CARD 4: Profile & Account Settings Form with Danger Zone */}
          <section className="profile-card" aria-labelledby="settings-heading">
            <div className="profile-card-header">
              <h2 id="settings-heading">
                <Icon name="user" size={20} /> Profile &amp; Settings
              </h2>
              <p>Display information</p>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="profile-form-group">
                <label htmlFor="first-name-input">Display Name</label>
                <p className="profile-form-hint">Shown on your certificate, leaderboard, and greetings.</p>
                <div className="profile-input-row">
                  <input
                    id="first-name-input"
                    type="text"
                    value={firstName}
                    maxLength={50}
                    required
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <label htmlFor="username-display">Username</label>
                <p className="profile-form-hint">Unique handle displayed on public leaderboards.</p>
                <div className="profile-input-row">
                  <input
                    id="username-display"
                    type="text"
                    value={`@${username}`}
                    disabled
                    style={{ opacity: 0.7, background: "var(--surface-sunk)" }}
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <label htmlFor="linkedin-input">LinkedIn Profile URL</label>
                <p className="profile-form-hint">
                  Adds a clickable LinkedIn link next to your name on the leaderboard.
                </p>
                <div className="profile-input-row">
                  <input
                    id="linkedin-input"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                  <button className="btn" type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {profileMsg && (
                <p className={`profile-feedback ${profileMsg.ok ? "is-success" : "is-error"}`} role="alert">
                  {profileMsg.text}
                </p>
              )}
            </form>

            {/* Membership Plan Section */}
            <div style={{ marginTop: "var(--s5)", paddingTop: "var(--s4)", borderTop: "1px solid var(--border)" }}>
              <div className="sub-plan-row">
                <div className="sub-plan-info">
                  <h3>{isPremium ? `${plan ? plan.toUpperCase() : "PRO"} Membership` : "Free Tier"}</h3>
                  <p>
                    {isPremium
                      ? activePeriodEnd
                        ? `Renews / ends on ${new Date(activePeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
                        : "All 86 lessons unlocked · Certificate access"
                      : "2 free lessons unlocked · Upgrade for all 86 lessons & certificate"}
                  </p>
                </div>
                {isPremium ? (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    style={{ fontSize: "var(--fs-xs)" }}
                    onClick={handleCancelSubscription}
                    disabled={cancellingSub}
                  >
                    {cancellingSub ? "Cancelling…" : "Cancel Plan"}
                  </button>
                ) : (
                  <Link className="btn" href="/pricing">
                    Upgrade to PRO
                  </Link>
                )}
              </div>
              {subMsg && <p className="profile-feedback" style={{ color: "var(--ink)" }}>{subMsg}</p>}
            </div>

            {/* Danger Zone: Reset Learning Progress */}
            <div style={{ marginTop: "var(--s5)", paddingTop: "var(--s4)", borderTop: "1px solid var(--border)" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "var(--danger)" }}>
                Danger Zone
              </h3>
              <p style={{ margin: "0 0 var(--s3)", color: "var(--muted)", fontSize: "var(--fs-xs)" }}>
                Clear completed lesson checks and accuracy metrics to practice the curriculum from scratch. Points &amp; leaderboard history are preserved.
              </p>
              <button
                type="button"
                className="btn"
                style={{ borderColor: "var(--danger)", color: "var(--danger)", width: "100%" }}
                onClick={() => setShowResetModal(true)}
              >
                Reset Learning Progress…
              </button>
            </div>

            {/* Account Sign Out */}
            <div style={{ marginTop: "var(--s4)", paddingTop: "var(--s4)", borderTop: "1px solid var(--border)" }}>
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button
                  type="submit"
                  className="btn btn-quiet"
                  style={{ width: "100%", justifyContent: "center", gap: 8 }}
                >
                  <Icon name="logOut" size={16} />
                  Log Out
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* EDIT PROFILE MODAL (Triggered by Cover Banner Edit Button) */}
      {showEditModal && (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
          <div className="profile-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s3)" }}>
              <h3 id="edit-modal-title" style={{ margin: 0 }}>Edit Profile</h3>
              <button
                type="button"
                className="btn btn-quiet"
                style={{ padding: "4px 8px" }}
                onClick={() => setShowEditModal(false)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="profile-form-group">
                <label htmlFor="modal-name">Display Name</label>
                <div className="profile-input-row">
                  <input
                    id="modal-name"
                    type="text"
                    value={firstName}
                    maxLength={50}
                    required
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <label htmlFor="modal-username">Username</label>
                <div className="profile-input-row">
                  <input
                    id="modal-username"
                    type="text"
                    value={`@${username}`}
                    disabled
                    style={{ opacity: 0.7, background: "var(--surface-sunk)" }}
                  />
                </div>
              </div>

              <div className="profile-form-group">
                <label htmlFor="modal-linkedin">LinkedIn Profile URL</label>
                <p className="profile-form-hint">Shown as a profile link on the public leaderboard.</p>
                <div className="profile-input-row">
                  <input
                    id="modal-linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                </div>
              </div>

              {profileMsg && (
                <p className={`profile-feedback ${profileMsg.ok ? "is-success" : "is-error"}`} role="alert">
                  {profileMsg.text}
                </p>
              )}

              <div className="profile-modal-actions" style={{ marginTop: "var(--s4)" }}>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingProfile}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={savingProfile}>
                  {savingProfile ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="profile-modal">
            <h3 id="modal-title">Reset your learning progress?</h3>
            <p>
              This will clear all completed lesson checks and reset your learning accuracy metrics to zero. You will start fresh on Module 1. This action cannot be undone.
            </p>
            <div className="profile-modal-actions">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}
                onClick={handleResetProgress}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Yes, reset my progress"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
