"use client";

import {
  achievementIconBoxClasses,
  achievementMeterFillClasses,
  badgeItemClasses,
  duoAchievementCardClasses,
  duoTabBtnClasses,
  friendActionRowClasses,
  lbStatusBoxClasses,
  lbTypeBtnClasses,
  profileCardHeaderClasses,
  profileInputRowClasses,
  profileModalClasses,
  statIconBoxClasses,
  statQuadCardClasses,
  stripedClasses,
} from "./profile-styles";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Leaderboards } from "@/components/Leaderboards";
import {
  computeLeagueTier,
  pickFeaturedModules,
  type LeagueTier,
  type ModuleProgressItem,
  type RecentLessonItem,
  type WeeklyDay,
} from "@/lib/profile-stats";

export type Milestone = {
  title: string;
  desc: string;
  unlocked: boolean;
  progressLabel: string;
  icon: IconName;
};

export type CertificateData = {
  credentialId: string;
  name: string;
  issuedAt: string;
};

export type ProfileClientProps = {
  initialFirstName: string;
  username: string;
  email: string | null;
  initialLinkedInUrl: string | null;
  sharedOnLinkedIn: boolean;
  hasFullAccess: boolean;
  isInvited: boolean;
  isGroupPaid: boolean;
  groupName: string | null;
  canCancel: boolean;
  paymentsEnabled: boolean;
  plan: string | null;
  periodEnd: string | null;
  joinedDate: string;
  // Learning stats
  currentStreak: number;
  longestStreak: number;
  streakMessage: string;
  totalPoints: number;
  todayPoints: number;
  pointsRank: number | null;
  streakRank: number | null;
  completedCount: number;
  totalLessons: number;
  progressPct: number;
  hasAccuracyData: boolean;
  averageAccuracy: number;
  perfectLessonsCount: number;
  accuracyTier: { label: string; desc: string };
  leagueTier: LeagueTier;
  moduleBreakdown: ModuleProgressItem[];
  weeklyActivity: WeeklyDay[];
  recentLessons: RecentLessonItem[];
  nextRecommendedHref: string;
  milestones: Milestone[];
  initialCertificate: CertificateData | null;
};

const TRACK_COLORS = ["is-mint", "is-butter", "is-lilac", "is-sky"] as const;

export function ProfileClient({
  initialFirstName,
  username,
  email,
  initialLinkedInUrl,
  sharedOnLinkedIn: initialShared,
  hasFullAccess,
  isInvited,
  isGroupPaid,
  groupName,
  canCancel: initialCanCancel,
  paymentsEnabled,
  plan,
  periodEnd,
  joinedDate,
  currentStreak,
  longestStreak,
  streakMessage,
  totalPoints: serverTotalPoints,
  todayPoints: serverTodayPoints,
  pointsRank,
  streakRank,
  completedCount,
  totalLessons,
  progressPct,
  hasAccuracyData,
  averageAccuracy,
  perfectLessonsCount,
  accuracyTier,
  leagueTier: initialLeagueTier,
  moduleBreakdown,
  weeklyActivity,
  recentLessons,
  nextRecommendedHref,
  milestones,
  initialCertificate,
}: ProfileClientProps) {
  const router = useRouter();

  // Committed profile display state (only updated after successful API save)
  const [savedFirstName, setSavedFirstName] = useState(initialFirstName);
  const [savedLinkedinUrl, setSavedLinkedinUrl] = useState(initialLinkedInUrl ?? "");

  // Isolated inline settings form draft state
  const [inlineFirstName, setInlineFirstName] = useState(initialFirstName);
  const [inlineLinkedinUrl, setInlineLinkedinUrl] = useState(initialLinkedInUrl ?? "");
  const [savingInline, setSavingInline] = useState(false);
  const [inlineMsg, setInlineMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Isolated Edit Profile Modal draft state
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalFirstName, setModalFirstName] = useState(initialFirstName);
  const [modalLinkedinUrl, setModalLinkedinUrl] = useState(initialLinkedInUrl ?? "");
  const [savingModal, setSavingModal] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Track badges expand toggle
  const [showAllTracks, setShowAllTracks] = useState(false);

  // Sidebar Tabbed Leaderboard state
  const [sidebarTab, setSidebarTab] = useState<"leaders" | "standings">("leaders");
  const [leaderboardType, setLeaderboardType] = useState<"points" | "streak">("points");

  // Share bonus & invite link state
  const [shared, setShared] = useState(initialShared);
  const [bonusAdded, setBonusAdded] = useState(0);
  const [claimingShare, setClaimingShare] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [manualInviteUrl, setManualInviteUrl] = useState<string | null>(null);

  // View all achievements toggle
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  // Certificate issuance & download state
  const [certificate, setCertificate] = useState<CertificateData | null>(initialCertificate);
  const [issuingCert, setIssuingCert] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  // Reset progress modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Cancel subscription modal state
  const [canCancel, setCanCancel] = useState(initialCanCancel);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activePeriodEnd, setActivePeriodEnd] = useState(periodEnd);

  // Live points including instant share bonus feedback
  const totalPoints = serverTotalPoints + bonusAdded;
  const todayPoints = serverTodayPoints + bonusAdded;
  const leagueTier = bonusAdded > 0 ? computeLeagueTier(totalPoints) : initialLeagueTier;

  // Global Escape key listener for active modals
  useEffect(() => {
    if (!showEditModal && !showResetModal && !showCancelModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showEditModal && !savingModal) setShowEditModal(false);
      if (showResetModal && !resetting) setShowResetModal(false);
      if (showCancelModal && !cancellingSub) setShowCancelModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showEditModal, showResetModal, showCancelModal, savingModal, resetting, cancellingSub]);

  const submitProfileUpdate = async (
    nextFirstName: string,
    nextLinkedin: string,
    source: "inline" | "modal",
  ) => {
    const setBusy = source === "modal" ? setSavingModal : setSavingInline;
    const setFeedback = source === "modal" ? setModalMsg : setInlineMsg;
    setBusy(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: nextFirstName,
          linkedinUrl: nextLinkedin.trim() === "" ? null : nextLinkedin.trim(),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        profile?: { first_name: string; linkedin_url: string | null };
      };

      if (!res.ok || !data.ok) {
        setFeedback({ text: data.error ?? "Failed to update profile", ok: false });
        return;
      }

      const updatedName = data.profile?.first_name ?? nextFirstName.trim();
      const updatedLinkedIn = data.profile?.linkedin_url ?? "";

      setSavedFirstName(updatedName);
      setSavedLinkedinUrl(updatedLinkedIn);
      setInlineFirstName(updatedName);
      setInlineLinkedinUrl(updatedLinkedIn);
      setModalFirstName(updatedName);
      setModalLinkedinUrl(updatedLinkedIn);

      if (certificate && certificate.name !== updatedName) {
        setCertificate({ ...certificate, name: updatedName });
      }

      setFeedback({ text: "Profile updated", ok: true });
      window.dispatchEvent(new Event("excelguru:profile-updated"));
      router.refresh();

      if (source === "modal") {
        setTimeout(() => {
          setShowEditModal(false);
          setModalMsg(null);
        }, 650);
      }
    } catch {
      setFeedback({ text: "Network error. Please try again.", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenEditModal = () => {
    setModalFirstName(savedFirstName);
    setModalLinkedinUrl(savedLinkedinUrl);
    setModalMsg(null);
    setShowEditModal(true);
  };

  const handleShareBonus = async () => {
    setClaimingShare(true);
    setShareFeedback(null);

    const origin = window.location.origin;
    const shareUrl = encodeURIComponent(origin);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer,width=600,height=600",
    );

    try {
      const res = await fetch("/api/share-bonus", { method: "POST" });
      const data = (await res.json()) as { points?: number; error?: string };
      if (res.ok) {
        setShared(true);
        setBonusAdded((prev) => prev + (data.points ?? 500));
        setShareFeedback({ text: "+500 pts credited to your score", ok: true });
        window.dispatchEvent(new Event("excelguru:share-bonus"));
        router.refresh();
      } else if (res.status === 409) {
        setShared(true);
        setShareFeedback({ text: "Share bonus was already claimed on this account.", ok: true });
      } else {
        setShareFeedback({ text: data.error ?? "Could not claim share bonus.", ok: false });
      }
    } catch {
      setShareFeedback({ text: "Network error claiming share bonus.", ok: false });
    } finally {
      setClaimingShare(false);
    }
  };

  const handleCopyInviteLink = async () => {
    const url = `${window.location.origin}/signup?ref=${encodeURIComponent(username)}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setManualInviteUrl(null);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      // Clipboard blocked or unavailable: show real copyable input instead of claiming copied
      setManualInviteUrl(url);
    }
  };

  const handleDownloadCertificate = async () => {
    setIssuingCert(true);
    setCertError(null);
    try {
      const res = await fetch("/api/certificate", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; certificate?: CertificateData };
      if (!res.ok || !data.ok || !data.certificate) {
        setCertError(data.error ?? "Could not generate certificate.");
        return;
      }
      setCertificate(data.certificate);
      // Trigger direct SVG file download
      const link = document.createElement("a");
      link.href = "/api/certificate?download=1";
      link.download = `excel-guru-certificate-${data.certificate.credentialId}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      router.refresh();
    } catch {
      setCertError("Network error preparing certificate.");
    } finally {
      setIssuingCert(false);
    }
  };

  const handleResetProgress = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/progress/reset", { method: "POST" });
      if (res.ok) {
        setShowResetModal(false);
        window.location.reload();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setResetError(data.error ?? "Failed to reset progress. Please try again.");
      }
    } catch {
      setResetError("Network error while resetting progress.");
    } finally {
      setResetting(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancellingSub(true);
    setSubMsg(null);
    try {
      const res = await fetch("/api/billing/manage", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; endsAt?: string | null; error?: string };
      if (res.ok && data.ok) {
        setShowCancelModal(false);
        setCanCancel(false);
        setSubMsg({ text: "Subscription scheduled to cancel at the end of your billing period.", ok: true });
        if (data.endsAt) setActivePeriodEnd(data.endsAt);
        router.refresh();
      } else {
        setSubMsg({ text: data.error ?? "Could not cancel subscription.", ok: false });
        setShowCancelModal(false);
      }
    } catch {
      setSubMsg({ text: "Network error while managing subscription.", ok: false });
      setShowCancelModal(false);
    } finally {
      setCancellingSub(false);
    }
  };

  const avatarChar = savedFirstName ? savedFirstName.charAt(0).toUpperCase() : "G";
  const featuredModules = pickFeaturedModules(moduleBreakdown, 4);
  const displayedTracks = showAllTracks ? moduleBreakdown : featuredModules;
  const remainingTrackCount = Math.max(0, moduleBreakdown.length - featuredModules.length);
  const unlockedMilestonesCount = milestones.filter((m) => m.unlocked).length;
  const weeklyTotal = weeklyActivity.reduce((sum, d) => sum + d.points, 0);
  const maxWeeklyDayPoints = Math.max(10, ...weeklyActivity.map((d) => d.points));
  const certificateUnlocked = hasFullAccess && completedCount >= totalLessons;

  const accessLabel = isInvited
    ? "Invited Access"
    : isGroupPaid
    ? groupName ?? "Team Access"
    : hasFullAccess
    ? "PRO Member"
    : "Free Tier";

  return (
    <>
      {/* 1. TOP HERO COVER BANNER */}
      <section className="duo-hero-banner relative w-full min-h-[200px] [background-color:var(--mint)]
          [background-image:linear-gradient(to_right,_rgba(15,_23,_42,_0.08)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(15,_23,_42,_0.08)_1px,_transparent_1px)]
          [background-size:24px_24px] [background-position:-1px_-1px] [border:var(--line)] rounded-ledger-lg
          [box-shadow:var(--shadow-pop)] flex items-center justify-center p-[var(--s6)_var(--s4)] mb-s5 overflow-hidden
          [@media(540px<width<=960px)]:min-h-[180px]
          [@media(max-width:540px)]:min-h-[160px] [@media(max-width:540px)]:p-s4" aria-label="Profile cover banner">
        <span className="duo-cell-ref absolute top-[16px] left-[16px] p-[4px_10px] rounded-ledger-sm [border:1.5px_solid_var(--ink)] bg-surface
          [box-shadow:2px_2px_0_var(--ink)] font-ledger-code text-[0.72rem] font-bold tracking-[0.05em] text-ink" aria-hidden="true">
          A1 · Profile
        </span>

        {/* Centered Retro Avatar */}
        <div className="duo-avatar-wrap relative flex flex-col items-center justify-center z-[2]">
          <div className="duo-avatar grid place-items-center w-[96px] h-[96px] rounded-[20px] bg-butter [border:2.5px_solid_var(--ink)]
          [box-shadow:4px_4px_0_var(--ink)] text-ink font-heading text-[2.5rem] [font-weight:800] uppercase
          [user-select:none] [transition:transform_var(--d2)_var(--ease),_box-shadow_var(--d2)_var(--ease)]
          [@media(540px<width<=720px)]:w-[84px] [@media(540px<width<=720px)]:h-[84px]
          [@media(540px<width<=720px)]:text-[2.1rem]
          [@media(max-width:540px)]:w-[76px] [@media(max-width:540px)]:h-[76px] [@media(max-width:540px)]:text-[1.85rem]
          [&:hover]:[transform:translateY(-2px)_scale(1.02)] [&:hover]:[box-shadow:6px_6px_0_var(--ink)]" aria-hidden="true">
            {avatarChar}
          </div>
        </div>

        {/* Edit Profile Modal Trigger Button in Top Right */}
        <button
          type="button"
          className="duo-edit-btn absolute top-[16px] right-[16px] z-[3] inline-flex items-center justify-center gap-[6px] w-[40px] h-[40px] p-0
          rounded-[50%] bg-surface [border:2px_solid_var(--ink)] [box-shadow:2.5px_2.5px_0_var(--ink)] text-ink
          cursor-pointer
          [transition:transform_var(--d1)_var(--ease),_box-shadow_var(--d1)_var(--ease),_background_var(--d1)]
          [&:hover]:bg-butter [&:hover]:[transform:translate(-1px,_-1px)] [&:hover]:[box-shadow:4px_4px_0_var(--ink)]
          [&:active]:[transform:translate(2px,_2px)] [&:active]:[box-shadow:0_0_0_var(--ink)]"
          aria-label="Edit Profile"
          title="Edit Profile"
          onClick={handleOpenEditModal}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </section>

      {/* 2. IDENTITY ROW BELOW BANNER */}
      <section className="duo-identity-row flex items-start justify-between gap-s5 mb-s6 p-[0_var(--s2)]
          [@media(max-width:720px)]:items-start [@media(max-width:720px)]:gap-s4 [@media(max-width:720px)]:flex-col" aria-label="User identification">
        <div className="identity-main flex flex-col gap-[4px]">
          <div className="identity-title-line flex flex-wrap items-center gap-[10px]">
            <h1 className="identity-name m-0 font-heading text-[clamp(1.8rem,_4vw,_2.35rem)] [font-weight:800] tracking-[-0.03em] text-ink leading-[1.15]">{savedFirstName}</h1>
            <span className={`profile-badge ${hasFullAccess ? "is-pro" : "is-free"} inline-flex items-center gap-[6px] p-[3px_10px] rounded-[9999px] text-ledger-xs font-bold tracking-[0.04em]
          uppercase [border:1.5px_solid_var(--ink)]
          [&.is-pro]:bg-primary [&.is-pro]:text-primary-ink [&.is-pro]:[box-shadow:2px_2px_0_var(--ink)]
          [&.is-free]:bg-butter [&.is-free]:text-ink [&.is-free]:[box-shadow:2px_2px_0_var(--ink)]`}>{accessLabel}</span>
          </div>
          <p className="identity-handle font-ledger-code text-[0.95rem] font-semibold text-muted m-0">
            @{username}
            {email ? <span className="identity-email font-normal text-muted text-[0.85rem]"> · {email}</span> : null}
          </p>
          <div className="identity-joined inline-flex items-center gap-[6px] text-ledger-sm text-muted mt-[2px]">
            <span>Joined {joinedDate}</span>
            {savedLinkedinUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={savedLinkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="identity-linkedin-link inline-flex items-center gap-[4px] text-primary font-semibold no-underline
          [&:hover]:underline"
                >
                  LinkedIn <Icon name="externalLink" size={12} />
                </a>
              </>
            )}
          </div>
          <div className="identity-social-links flex items-center gap-s4 mt-[8px]">
            <Link href="/dashboard" className="social-stat-link text-ledger-sm font-bold text-primary no-underline [border-bottom:2px_solid_transparent]
          [transition:border-color_var(--d1),_color_var(--d1)]
          [&:hover]:text-primary-strong [&:hover]:[border-bottom-color:var(--primary)]">
              {completedCount} / {totalLessons} Lessons Done
            </Link>
            <span className="identity-dot text-faint" aria-hidden="true">
              ·
            </span>
            <a href="#curriculum-heading" className="social-stat-link text-ledger-sm font-bold text-primary no-underline [border-bottom:2px_solid_transparent]
          [transition:border-color_var(--d1),_color_var(--d1)]
          [&:hover]:text-primary-strong [&:hover]:[border-bottom-color:var(--primary)]">
              {hasAccuracyData ? `${averageAccuracy}% Learning Rate` : "No Accuracy Yet"}
            </a>
          </div>
        </div>

        {/* Real Course Track Badges on Right Side */}
        <div className="duo-track-badges flex items-center justify-end gap-[8px] flex-wrap pt-[6px]
          [@media(max-width:720px)]:[justify-content:flex-start]" aria-label="Formula course tracks">
          {displayedTracks.map((mod, idx) => (
            <Link
              key={mod.slug}
              href={`/modules/${mod.slug}`}
              className={`track-badge-pill ${TRACK_COLORS[idx % TRACK_COLORS.length]} ${mod.done >= mod.total ? "is-complete" : ""} inline-flex items-center gap-[6px] p-[6px_12px] rounded-[9999px] [border:1.5px_solid_var(--ink)]
          [box-shadow:2px_2px_0_var(--ink)] font-ledger-code text-[0.8rem] font-bold text-ink bg-surface whitespace-nowrap
          [user-select:none] [transition:transform_var(--d1)_var(--ease),_box-shadow_var(--d1)_var(--ease)] no-underline
          [&:hover]:[transform:translate(-1px,_-1px)] [&:hover]:[box-shadow:3px_3px_0_var(--ink)]
          [&.is-mint]:bg-mint
          [&.is-butter]:bg-butter
          [&.is-lilac]:bg-lilac
          [&.is-sky]:bg-sky
          [&.is-complete]:border-primary-strong
          [&:active]:[transform:scale(0.98)]`}
              title={`${mod.title}: ${mod.done}/${mod.total} lessons`}
            >
              {mod.done >= mod.total ? <Icon name="check" size={12} strokeWidth={3} /> : null}
              <span>{mod.title}</span>
              <small className="track-badge-count text-[0.72rem] opacity-[0.75] font-semibold tabular-nums">
                {mod.done}/{mod.total}
              </small>
            </Link>
          ))}
          {remainingTrackCount > 0 && (
            <button
              type="button"
              className="track-badge-more inline-flex items-center justify-center p-[6px_10px] rounded-[9999px] [border:1.5px_solid_var(--ink)]
          [box-shadow:2px_2px_0_var(--ink)] bg-surface-sunk text-ink font-ledger-code text-[0.75rem] font-bold
          [user-select:none] cursor-pointer [transition:background_var(--d1),_transform_var(--d1)]
          [&:hover]:bg-butter [&:hover]:[transform:translate(-1px,_-1px)]
          [&:active]:[transform:scale(0.98)]"
              aria-expanded={showAllTracks}
              onClick={() => setShowAllTracks((prev) => !prev)}
            >
              {showAllTracks ? "Show top 4" : `+${remainingTrackCount} more`}
            </button>
          )}
        </div>
      </section>

      {/* 3. TWO-COLUMN LAYOUT */}
      <div className="profile-content-layout grid grid-cols-[minmax(0,_1.65fr)_minmax(0,_1fr)] gap-s6 [align-items:start]
          [@media(max-width:960px)]:grid-cols-[minmax(0,_1fr)]">
        {/* LEFT / MAIN COLUMN */}
        <div className="profile-column flex flex-col gap-s6">
          {/* STATISTICS 2x2 QUAD GRID */}
          <section className="duo-stats-section mb-s7" aria-label="Learning statistics">
            <div className="section-head-inline flex items-center justify-between gap-s3 mb-s4">
              <h2 className="duo-section-title m-[0_0_var(--s4)] font-heading text-[clamp(1.35rem,_3vw,_1.65rem)] [font-weight:800] tracking-[-0.02em] text-ink" style={{ margin: 0 }}>
                Statistics
              </h2>
              <Link className="btn btn-sm" href={nextRecommendedHref}>
                {completedCount === 0 ? "Start Lesson 1" : completedCount >= totalLessons ? "Review Formulas" : "Next Lesson"}{" "}
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <div className="duo-stats-grid grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-s4 mb-s6
          [@media(max-width:540px)]:grid-cols-[minmax(0,_1fr)]">
              {/* Stat 1: Day Streak */}
              <div className={`stat-quad-card ${statQuadCardClasses}`}>
                <div className={`stat-icon-box is-streak ${statIconBoxClasses}`}>
                  <Icon name="flame" size={24} />
                </div>
                <div className="stat-content flex flex-col gap-[2px] min-w-0">
                  <p className="stat-val m-0 font-ledger-code tabular-nums text-[1.85rem] [font-weight:800] leading-[1.1] text-ink tracking-[-0.02em]
          [&_span]:text-[0.95rem] [&_span]:font-semibold [&_span]:text-muted [&_span]:ml-[4px]">
                    {currentStreak}
                    <span>{currentStreak === 1 ? "day" : "days"}</span>
                  </p>
                  <p className="stat-label m-0 text-ledger-sm font-semibold text-muted">Day streak · Best {longestStreak}d</p>
                </div>
              </div>

              {/* Stat 2: Total XP / Points */}
              <div className={`stat-quad-card ${statQuadCardClasses}`}>
                <div className={`stat-icon-box is-xp ${statIconBoxClasses}`}>
                  <Icon name="zap" size={24} />
                </div>
                <div className="stat-content flex flex-col gap-[2px] min-w-0">
                  <p className="stat-val m-0 font-ledger-code tabular-nums text-[1.85rem] [font-weight:800] leading-[1.1] text-ink tracking-[-0.02em]
          [&_span]:text-[0.95rem] [&_span]:font-semibold [&_span]:text-muted [&_span]:ml-[4px]">
                    {totalPoints.toLocaleString()}
                    <span>pts</span>
                  </p>
                  <p className="stat-label m-0 text-ledger-sm font-semibold text-muted">
                    Total XP {todayPoints > 0 ? `· +${todayPoints} today` : ""}
                  </p>
                </div>
              </div>

              {/* Stat 3: Formula Tier / Current League */}
              <div className={`stat-quad-card ${statQuadCardClasses}`}>
                <div className={`stat-icon-box ${leagueTier.colorClass} ${statIconBoxClasses}`}>
                  <Icon name="award" size={24} />
                </div>
                <div className="stat-content flex flex-col gap-[2px] min-w-0">
                  <p className="stat-val m-0 font-ledger-code tabular-nums text-[1.85rem] [font-weight:800] leading-[1.1] text-ink tracking-[-0.02em]
          [&_span]:text-[0.95rem] [&_span]:font-semibold [&_span]:text-muted [&_span]:ml-[4px]">{leagueTier.name}</p>
                  <p className="stat-label m-0 text-ledger-sm font-semibold text-muted">
                    {leagueTier.nextName
                      ? `${leagueTier.pointsToNext.toLocaleString()} pts to ${leagueTier.nextName}`
                      : "Top league reached"}
                  </p>
                </div>
              </div>

              {/* Stat 4: Learning Rate (First-Try Accuracy) */}
              <div className={`stat-quad-card ${statQuadCardClasses}`}>
                <div className={`stat-icon-box is-rank ${statIconBoxClasses}`}>
                  <Icon name="target" size={24} />
                </div>
                <div className="stat-content flex flex-col gap-[2px] min-w-0">
                  <p className="stat-val m-0 font-ledger-code tabular-nums text-[1.85rem] [font-weight:800] leading-[1.1] text-ink tracking-[-0.02em]
          [&_span]:text-[0.95rem] [&_span]:font-semibold [&_span]:text-muted [&_span]:ml-[4px]">
                    {hasAccuracyData ? `${averageAccuracy}%` : "—"}
                  </p>
                  <p className="stat-label m-0 text-ledger-sm font-semibold text-muted">
                    {hasAccuracyData
                      ? `Learning rate · ${accuracyTier.label}`
                      : "Complete a lesson to measure"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* WEEKLY XP ACTIVITY STRIP (Real 7-day IST points_log) */}
          <section className="profile-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]" aria-labelledby="weekly-heading">
            <div className={`profile-card-header ${profileCardHeaderClasses}`}>
              <h2 id="weekly-heading">
                <Icon name="zap" size={20} /> 7-Day Learning Activity
              </h2>
              <p>{weeklyTotal > 0 ? `+${weeklyTotal.toLocaleString()} pts this week` : "No points logged this week"}</p>
            </div>
            <div className="weekly-grid grid grid-cols-[repeat(7,_minmax(0,_1fr))] gap-s2
          [@media(max-width:540px)]:gap-[4px]" role="list" aria-label="Points earned per day over the last 7 days">
              {weeklyActivity.map((day) => {
                const barHeight = day.points > 0 ? Math.max(20, Math.round((day.points / maxWeeklyDayPoints) * 100)) : 8;
                return (
                  <div
                    key={day.date}
                    role="listitem"
                    className={`weekly-cell ${day.isToday ? "is-today" : ""} ${day.points > 0 ? "is-active" : ""} flex flex-col items-center gap-[6px] p-[10px_4px] rounded-[var(--r-md,_8px)] [border:1.5px_solid_var(--border)]
          bg-surface-sunk
          [@media(max-width:540px)]:p-[8px_2px]
          [&.is-active]:bg-surface [&.is-active]:border-ink [&.is-active]:[box-shadow:2px_2px_0_var(--ink)]
          [&.is-today]:border-primary [&.is-today]:bg-primary-tint
          [&.is-active_.weekly-pts]:text-primary-strong
          [&.is-active_.weekly-bar-fill]:bg-primary`}
                    title={`${day.date}: ${day.points} pts`}
                  >
                    <span className="weekly-pts font-ledger-code text-[0.72rem] font-bold text-muted tabular-nums
          [@media(max-width:540px)]:text-[0.65rem]">{day.points > 0 ? `+${day.points}` : "0"}</span>
                    <div className="weekly-bar-track w-[14px] h-[48px] flex items-end [background:rgba(20,_32,_26,_0.08)] rounded-[4px] overflow-hidden" aria-hidden="true">
                      <div className="weekly-bar-fill w-full bg-faint rounded-[3px] [transition:height_0.35s_var(--ease)]" style={{ height: `${barHeight}%` }} />
                    </div>
                    <span className="weekly-day font-ledger-code text-[0.72rem] font-bold text-ink">{day.dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. ACHIEVEMENTS SECTION */}
          <section className="duo-achievements-section mb-s7" aria-label="Achievements and milestones">
            <div className="achievements-section-header flex items-baseline justify-between gap-s3 mb-s4
          [&_h2]:m-0 [&_h2]:font-heading [&_h2]:text-[clamp(1.35rem,_3vw,_1.65rem)] [&_h2]:[font-weight:800]
          [&_h2]:tracking-[-0.02em] [&_h2]:text-ink">
              <div>
                <h2>Achievements</h2>
                <p className="achievements-sub m-[2px_0_0] text-ledger-xs text-muted font-ledger-code">{unlockedMilestonesCount} of {milestones.length} badges unlocked</p>
              </div>
              <button
                type="button"
                className="achievements-view-all font-ledger-code text-ledger-xs font-bold text-primary-strong [background:transparent]
          [border:1.5px_solid_transparent] no-underline cursor-pointer p-[5px_10px] rounded-ledger-sm
          [transition:color_150ms_cubic-bezier(0.23,_1,_0.32,_1),_background-color_150ms_cubic-bezier(0.23,_1,_0.32,_1),_border-color_150ms_ease,_transform_150ms_cubic-bezier(0.23,_1,_0.32,_1)]
          [&:hover]:text-ink [&:hover]:bg-primary-tint [&:hover]:border-ink
          [&:active]:[transform:scale(0.97)]"
                aria-expanded={showAllAchievements}
                onClick={() => setShowAllAchievements(!showAllAchievements)}
              >
                {showAllAchievements ? "Show less" : "View all"}
              </button>
            </div>

            <div className="achievements-list flex flex-col gap-s3">
              {/* Achievement 1: Wildfire Streak */}
              <div className={`duo-achievement-card ${duoAchievementCardClasses}`}>
                <div className="achievement-row-top flex items-center gap-s4">
                  <div className={`achievement-icon-box is-butter ${achievementIconBoxClasses}`}>
                    <Icon name="flame" size={26} />
                  </div>
                  <div className="achievement-info [flex:1] min-w-0">
                    <div className="achievement-title-row flex items-baseline justify-between gap-s2 mb-[2px]
          [@media(max-width:540px)]:items-start [@media(max-width:540px)]:gap-[2px] [@media(max-width:540px)]:flex-col">
                      <h3 className="achievement-title m-0 font-heading text-[1.05rem] font-bold text-ink">Wildfire</h3>
                      <span className="achievement-score font-ledger-code text-ledger-xs font-bold text-muted whitespace-nowrap tabular-nums">{Math.min(Math.max(currentStreak, longestStreak), 7)} / 7</span>
                    </div>
                    <p className="achievement-desc m-0 text-ledger-sm text-muted leading-[1.35]">Reach a 7-day streak to ignite formula mastery habits</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap w-full">
                  <div className={`achievement-meter striped relative w-full h-[12px] bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[9999px] overflow-hidden
          ${stripedClasses}`} aria-hidden="true">
                    <div
                      className={`achievement-meter-fill ${achievementMeterFillClasses}`}
                      style={{
                        width: `${Math.min(100, Math.round((Math.max(currentStreak, longestStreak) / 7) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 2: Formula Sniper Accuracy */}
              <div className={`duo-achievement-card ${duoAchievementCardClasses}`}>
                <div className="achievement-row-top flex items-center gap-s4">
                  <div className={`achievement-icon-box is-mint ${achievementIconBoxClasses}`}>
                    <Icon name="target" size={26} />
                  </div>
                  <div className="achievement-info [flex:1] min-w-0">
                    <div className="achievement-title-row flex items-baseline justify-between gap-s2 mb-[2px]
          [@media(max-width:540px)]:items-start [@media(max-width:540px)]:gap-[2px] [@media(max-width:540px)]:flex-col">
                      <h3 className="achievement-title m-0 font-heading text-[1.05rem] font-bold text-ink">Formula Sniper</h3>
                      <span className="achievement-score font-ledger-code text-ledger-xs font-bold text-muted whitespace-nowrap tabular-nums">{hasAccuracyData ? `${averageAccuracy}%` : "0%"} / 100%</span>
                    </div>
                    <p className="achievement-desc m-0 text-ledger-sm text-muted leading-[1.35]">
                      {hasAccuracyData
                        ? `${perfectLessonsCount} lesson${perfectLessonsCount === 1 ? "" : "s"} solved at 100% first-try accuracy`
                        : "Complete lessons cleanly on your first try to raise your learning rate"}
                    </p>
                  </div>
                </div>
                <div className="achievement-meter-wrap w-full">
                  <div className={`achievement-meter striped relative w-full h-[12px] bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[9999px] overflow-hidden
          ${stripedClasses}`} aria-hidden="true">
                    <div
                      className={`achievement-meter-fill ${achievementMeterFillClasses}`}
                      style={{ width: `${hasAccuracyData ? averageAccuracy : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 3: Century Club Points */}
              <div className={`duo-achievement-card ${duoAchievementCardClasses}`}>
                <div className="achievement-row-top flex items-center gap-s4">
                  <div className={`achievement-icon-box is-rose ${achievementIconBoxClasses}`}>
                    <Icon name="zap" size={26} />
                  </div>
                  <div className="achievement-info [flex:1] min-w-0">
                    <div className="achievement-title-row flex items-baseline justify-between gap-s2 mb-[2px]
          [@media(max-width:540px)]:items-start [@media(max-width:540px)]:gap-[2px] [@media(max-width:540px)]:flex-col">
                      <h3 className="achievement-title m-0 font-heading text-[1.05rem] font-bold text-ink">Century Club</h3>
                      <span className="achievement-score font-ledger-code text-ledger-xs font-bold text-muted whitespace-nowrap tabular-nums">
                        {Math.min(totalPoints, 1000).toLocaleString()} / 1,000
                      </span>
                    </div>
                    <p className="achievement-desc m-0 text-ledger-sm text-muted leading-[1.35]">Earn 1,000 total points solving spreadsheet challenges</p>
                  </div>
                </div>
                <div className="achievement-meter-wrap w-full">
                  <div className={`achievement-meter striped relative w-full h-[12px] bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[9999px] overflow-hidden
          ${stripedClasses}`} aria-hidden="true">
                    <div
                      className={`achievement-meter-fill ${achievementMeterFillClasses}`}
                      style={{ width: `${Math.min(100, Math.round((totalPoints / 1000) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Achievement 4: Grandmaster All Lessons */}
              <div className={`duo-achievement-card ${duoAchievementCardClasses}`}>
                <div className="achievement-row-top flex items-center gap-s4">
                  <div className={`achievement-icon-box is-lilac ${achievementIconBoxClasses}`}>
                    <Icon name="trophy" size={26} />
                  </div>
                  <div className="achievement-info [flex:1] min-w-0">
                    <div className="achievement-title-row flex items-baseline justify-between gap-s2 mb-[2px]
          [@media(max-width:540px)]:items-start [@media(max-width:540px)]:gap-[2px] [@media(max-width:540px)]:flex-col">
                      <h3 className="achievement-title m-0 font-heading text-[1.05rem] font-bold text-ink">Grandmaster</h3>
                      <span className="achievement-score font-ledger-code text-ledger-xs font-bold text-muted whitespace-nowrap tabular-nums">
                        {completedCount} / {totalLessons}
                      </span>
                    </div>
                    <p className="achievement-desc m-0 text-ledger-sm text-muted leading-[1.35]">
                      Complete all {totalLessons} interactive lessons across the full curriculum
                    </p>
                  </div>
                </div>
                <div className="achievement-meter-wrap w-full">
                  <div className={`achievement-meter striped relative w-full h-[12px] bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[9999px] overflow-hidden
          ${stripedClasses}`} aria-hidden="true">
                    <div
                      className={`achievement-meter-fill ${achievementMeterFillClasses}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Extra Unlocked Badges when VIEW ALL is open */}
              {showAllAchievements && (
                <div className="badges-grid grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-s3
          [@media(max-width:720px)]:grid-cols-[repeat(2,_minmax(0,_1fr))]" style={{ marginTop: "var(--s4)" }}>
                  {milestones.map((b) => (
                    <div key={b.title} className={`badge-item ${b.unlocked ? "is-unlocked" : ""} ${badgeItemClasses}`}>
                      <div className="badge-icon-box grid place-items-center w-[44px] h-[44px] rounded-[50%] mb-[8px] [border:1.5px_solid_var(--ink)] bg-mint
          text-ink">
                        <Icon name={b.unlocked ? "check" : b.icon} size={20} />
                      </div>
                      <strong>{b.title}</strong>
                      <small>{b.desc}</small>
                      <span className="badge-progress-pill mt-[6px] p-[2px_8px] rounded-[9999px] [border:1px_solid_var(--border)] bg-surface-sunk font-ledger-code
          text-[0.7rem] font-bold text-ink">{b.unlocked ? "Unlocked" : b.progressLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Curriculum Mastery by Module (Every module clickable & accurately slug-matched) */}
          <section className="profile-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]" aria-labelledby="curriculum-heading">
            <div className={`profile-card-header ${profileCardHeaderClasses}`}>
              <h2 id="curriculum-heading">
                <Icon name="grid" size={20} /> Curriculum Mastery by Module
              </h2>
              <p>
                {moduleBreakdown.filter((m) => m.done >= m.total).length} of {moduleBreakdown.length} complete
              </p>
            </div>

            <div className="mastery-module-list grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-s3
          [@media(max-width:580px)]:grid-cols-[minmax(0,_1fr)]">
              {moduleBreakdown.map((mod) => (
                <Link key={mod.slug} href={`/modules/${mod.slug}`} className="mastery-module-item p-[12px_14px] bg-surface-sunk [border:1.5px_solid_var(--ink)] rounded-[var(--r-md,_8px)] grid gap-[8px]
          no-underline [color:inherit]
          [transition:transform_160ms_cubic-bezier(0.23,_1,_0.32,_1),_box-shadow_160ms_cubic-bezier(0.23,_1,_0.32,_1),_background-color_160ms_ease]
          [&:active]:[transform:scale(0.98)]
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:bg-butter
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:[transform:translate(-1px,_-1px)]
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:[box-shadow:2.5px_2.5px_0_var(--ink)]
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:no-underline">
                  <div className="mastery-module-head flex items-center justify-between gap-[8px] text-ledger-sm
          [&_strong]:text-ink [&_strong]:font-bold [&_strong]:min-w-0 [&_strong]:overflow-hidden
          [&_strong]:[text-overflow:ellipsis] [&_strong]:whitespace-nowrap [&_strong]:inline-flex [&_strong]:items-center
          [&_strong]:gap-[6px]
          [&_span]:font-ledger-code [&_span]:tabular-nums [&_span]:text-ledger-xs [&_span]:text-text
          [&_span]:whitespace-nowrap">
                    <strong>
                      {mod.done >= mod.total ? <Icon name="check" size={14} className="mod-done-check text-primary [flex-shrink:0]" /> : null}
                      {mod.title}
                    </strong>
                    <span>
                      {mod.done} / {mod.total} ({mod.pct}%)
                    </span>
                  </div>
                  <div className="meter" style={{ height: 6 }} aria-hidden="true">
                    <i style={{ width: `${mod.pct}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Completed Lessons */}
          <section className="profile-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]" aria-labelledby="recent-heading">
            <div className={`profile-card-header ${profileCardHeaderClasses}`}>
              <h2 id="recent-heading">
                <Icon name="play" size={20} /> Recent Lessons
              </h2>
              <Link href="/dashboard" className="social-stat-link text-ledger-sm font-bold text-primary no-underline [border-bottom:2px_solid_transparent]
          [transition:border-color_var(--d1),_color_var(--d1)]
          [&:hover]:text-primary-strong [&:hover]:[border-bottom-color:var(--primary)]">
                All lessons →
              </Link>
            </div>

            {recentLessons.length === 0 ? (
              <div className="recent-empty text-center p-[var(--s4)_var(--s2)] text-muted text-ledger-sm
          [&_p]:m-[0_0_var(--s3)]">
                <p>You haven&apos;t completed a lesson yet. Start with our 2-minute interactive intro!</p>
                <Link className="btn" href={nextRecommendedHref}>
                  Start Learning <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            ) : (
              <ul className="recent-lessons-list list-none m-0 p-0 grid gap-s2">
                {recentLessons.map((item) => (
                  <li key={item.id}>
                    <Link href={`/lesson/${item.id}`} className="recent-lesson-row [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:bg-mint
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:[transform:translate(-1px,_-1px)]
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:[box-shadow:2.5px_2.5px_0_var(--ink)]
          [@media(hover:hover)_and_(pointer:fine)]:[&:hover]:no-underline
          [&:active]:[transform:scale(0.98)]
          flex items-center justify-between gap-s3 p-[10px_14px] [border:1.5px_solid_var(--ink)]
          rounded-[var(--r-md,_8px)] bg-surface-sunk no-underline text-ink
          [transition:background-color_150ms_ease,_transform_150ms_cubic-bezier(0.23,_1,_0.32,_1),_box-shadow_150ms_cubic-bezier(0.23,_1,_0.32,_1)]">
                      <div className="recent-lesson-main flex flex-col gap-[2px] min-w-0
          [&_strong]:text-ledger-sm [&_strong]:whitespace-nowrap [&_strong]:overflow-hidden
          [&_strong]:[text-overflow:ellipsis]
          [&_small]:font-ledger-code [&_small]:text-[0.74rem] [&_small]:text-muted">
                        <strong>{item.title}</strong>
                        <small>
                          {item.module}
                          {item.timesCompleted > 1 ? ` · Completed ${item.timesCompleted}×` : ""} ·{" "}
                          {new Date(item.completedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </small>
                      </div>
                      <span
                        className={`recent-acc-pill ${item.accuracyPct >= 90 ? "is-high" : item.accuracyPct >= 50 ? "is-mid" : "is-low"} tabular-nums [flex-shrink:0] p-[3px_9px] rounded-[9999px] [border:1.5px_solid_var(--ink)] font-ledger-code
          text-[0.75rem] font-bold
          [&.is-high]:bg-mint
          [&.is-mid]:bg-butter
          [&.is-low]:bg-rose`}
                      >
                        {item.accuracyPct}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT-HAND SIDEBAR COLUMN */}
        <div className="profile-column flex flex-col gap-s6">
          {/* SIDEBAR CARD 1: Tabbed Leaderboard card */}
          <section className="duo-tab-card bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)] overflow-hidden" aria-label="Leaderboard standings">
            <div className="duo-tabs-nav flex bg-surface-sunk [border-bottom:2px_solid_var(--ink)]" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "leaders"}
                className={`duo-tab-btn ${sidebarTab === "leaders" ? "is-active" : ""} ${duoTabBtnClasses}`}
                onClick={() => setSidebarTab("leaders")}
              >
                Today&apos;s Leaders
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "standings"}
                className={`duo-tab-btn ${sidebarTab === "standings" ? "is-active" : ""} ${duoTabBtnClasses}`}
                onClick={() => setSidebarTab("standings")}
              >
                Your Standings
              </button>
            </div>

            <div style={{ padding: "var(--s4)" }}>
              {sidebarTab === "leaders" ? (
                <div>
                  <div className="lb-type-toggle grid grid-cols-[1fr_1fr] gap-[6px] mb-s3" role="group" aria-label="Leaderboard metric">
                    <button
                      type="button"
                      className={`lb-type-btn ${leaderboardType === "points" ? "is-active" : ""} ${lbTypeBtnClasses}`}
                      onClick={() => setLeaderboardType("points")}
                    >
                      Points
                    </button>
                    <button
                      type="button"
                      className={`lb-type-btn ${leaderboardType === "streak" ? "is-active" : ""} ${lbTypeBtnClasses}`}
                      onClick={() => setLeaderboardType("streak")}
                    >
                      Streaks
                    </button>
                  </div>
                  <div className="duo-lb-embed [&_.leaderboard-card]:[border:0] [&_.leaderboard-card]:p-0 [&_.leaderboard-card]:[box-shadow:none]
          [&_.leaderboard-card]:[background:transparent]
          [&_.leaderboard-card_h2]:text-[0.95rem] [&_.leaderboard-card_h2]:mb-s2">
                    <Leaderboards
                      type={leaderboardType}
                      title={leaderboardType === "points" ? "Top Scorers Today" : "Top Streaks Today"}
                    />
                  </div>
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
                  <div className="lb-status-grid grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-s4 mb-s5
          [@media(max-width:720px)]:grid-cols-[minmax(0,_1fr)]">
                    <div className={`lb-status-box ${lbStatusBoxClasses}`}>
                      <h3>Points Rank</h3>
                      <div className={`lb-status-rank ${pointsRank && pointsRank <= 3 ? "is-top" : ""} font-ledger-code text-[1.75rem] [font-weight:800] text-ink tabular-nums
          [&.is-top]:text-primary`}>
                        {pointsRank ? `#${pointsRank}` : "Unranked"}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                        {todayPoints > 0 ? `+${todayPoints} pts today` : "Complete a lesson to enter"}
                      </p>
                    </div>
                    <div className={`lb-status-box ${lbStatusBoxClasses}`}>
                      <h3>Streak Rank</h3>
                      <div className={`lb-status-rank ${streakRank && streakRank <= 3 ? "is-top" : ""} font-ledger-code text-[1.75rem] [font-weight:800] text-ink tabular-nums
          [&.is-top]:text-primary`}>
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
          <section className="add-friends-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]
          [&_h3]:m-[0_0_var(--s3)] [&_h3]:font-heading [&_h3]:text-[1.15rem] [&_h3]:[font-weight:800] [&_h3]:text-ink" aria-label="Invite and share bonus">
            <h3>Add Friends &amp; Share</h3>
            <p style={{ margin: "0 0 var(--s4)", color: "var(--muted)", fontSize: "var(--fs-sm)" }}>
              Share your formula practice on LinkedIn for a one-time +500 XP boost on today&apos;s leaderboard.
            </p>

            <div className="friend-action-list flex flex-col gap-[8px]">
              {shared ? (
                <div className={`friend-action-row is-done-row ${friendActionRowClasses}`}>
                  <span className="friend-action-icon is-mint grid place-items-center w-[34px] h-[34px] rounded-ledger-sm [border:1.5px_solid_var(--ink)] bg-surface-sunk
          text-ink [flex-shrink:0]
          [&.is-mint]:bg-mint
          [&.is-butter]:bg-butter">
                    <Icon name="check" size={18} />
                  </span>
                  <span className="friend-action-text [flex:1] font-bold text-ledger-sm">+500 pts claimed on LinkedIn</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={`friend-action-row ${friendActionRowClasses}`}
                  onClick={handleShareBonus}
                  disabled={claimingShare}
                >
                  <span className="friend-action-icon is-butter grid place-items-center w-[34px] h-[34px] rounded-ledger-sm [border:1.5px_solid_var(--ink)] bg-surface-sunk
          text-ink [flex-shrink:0]
          [&.is-mint]:bg-mint
          [&.is-butter]:bg-butter">
                    <Icon name="externalLink" size={18} />
                  </span>
                  <span className="friend-action-text [flex:1] font-bold text-ledger-sm">
                    {claimingShare ? "Claiming bonus…" : "Share on LinkedIn (+500 pts)"}
                  </span>
                  <span className="friend-action-arrow text-muted [font-weight:800] text-[1.1rem]">→</span>
                </button>
              )}

              <button type="button" className={`friend-action-row ${friendActionRowClasses}`} onClick={handleCopyInviteLink}>
                <span className="friend-action-icon grid place-items-center w-[34px] h-[34px] rounded-ledger-sm [border:1.5px_solid_var(--ink)] bg-surface-sunk
          text-ink [flex-shrink:0]
          [&.is-mint]:bg-mint
          [&.is-butter]:bg-butter">
                  <Icon name="user" size={18} />
                </span>
                <span className="friend-action-text [flex:1] font-bold text-ledger-sm">
                  {copiedInvite ? "Signup invite link copied" : "Invite Friends (Copy Signup Link)"}
                </span>
                <span className="friend-action-arrow text-muted [font-weight:800] text-[1.1rem]">→</span>
              </button>
            </div>

            {manualInviteUrl && (
              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink" style={{ marginTop: "var(--s3)", marginBottom: 0 }}>
                <label htmlFor="manual-invite-url" style={{ fontSize: "var(--fs-xs)" }}>
                  Copy your invite link:
                </label>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="manual-invite-url"
                    type="text"
                    readOnly
                    value={manualInviteUrl}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              </div>
            )}

            {shareFeedback && (
              <p className={`profile-feedback ${shareFeedback.ok ? "is-success" : "is-error"} mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger`} role="status">
                {shareFeedback.text}
              </p>
            )}
          </section>

          {/* SIDEBAR CARD 3: Verified Certificate preview card */}
          <section className="profile-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]" aria-labelledby="cert-heading">
            <div className={`profile-card-header ${profileCardHeaderClasses}`}>
              <h2 id="cert-heading">
                <Icon name="award" size={20} /> Verified Certificate
              </h2>
              <span className="badge">{certificateUnlocked ? "Unlocked" : "In Progress"}</span>
            </div>

            <div className={`certificate-preview-box ${certificateUnlocked ? "is-unlocked" : ""} relative p-s5 [border:2px_dashed_var(--ink)] rounded-ledger-lg
          [background:linear-gradient(135deg,_#fdfbf7_0%,_#f7f3ec_100%)] text-center mb-s4
          [&.is-unlocked]:[border-style:solid] [&.is-unlocked]:border-primary [&.is-unlocked]:[background:#f0fdf4]
          [&.is-unlocked]:[box-shadow:3px_3px_0_var(--ink)]
          [&_h3]:m-[0_0_6px] [&_h3]:text-[1.15rem] [&_h3]:text-ink [&_h3]:font-heading [&_h3]:font-bold
          [&_p]:m-[0_0_var(--s4)] [&_p]:text-ledger-sm [&_p]:text-muted`}>
              <div className="cert-seal inline-grid place-items-center w-[48px] h-[48px] rounded-[50%] bg-primary text-primary-ink
          [border:1.5px_solid_var(--ink)] mb-s3 [box-shadow:2px_2px_0_var(--ink)]">
                <Icon name="award" size={26} />
              </div>
              <h3>Excel Formula Mastery</h3>
              <p>
                Official verifiable credential awarded upon completing all {totalLessons} curriculum lessons.
              </p>

              {certificateUnlocked ? (
                <div style={{ display: "grid", gap: "var(--s2)" }}>
                  <button
                    type="button"
                    className="btn btn-lg"
                    style={{ width: "100%" }}
                    onClick={handleDownloadCertificate}
                    disabled={issuingCert}
                  >
                    <Icon name="download" size={16} />{" "}
                    {issuingCert ? "Generating Certificate…" : "Download Certificate (SVG)"}
                  </button>
                  {certificate && (
                    <Link
                      href={`/verify?id=${encodeURIComponent(certificate.credentialId)}`}
                      className="btn btn-quiet"
                      style={{ width: "100%", fontSize: "var(--fs-xs)" }}
                    >
                      Verify ID: {certificate.credentialId} →
                    </Link>
                  )}
                  {certError && (
                    <p className="profile-feedback is-error mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger" role="alert">
                      {certError}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="meter" style={{ height: 8, marginBottom: 8 }} aria-hidden="true">
                    <i style={{ width: `${progressPct}%` }} />
                  </div>
                  <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
                    {completedCount} / {totalLessons} lessons finished ({progressPct}%).{" "}
                    {hasFullAccess
                      ? `Finish ${totalLessons - completedCount} more lesson${totalLessons - completedCount === 1 ? "" : "s"} to unlock.`
                      : "Upgrade to PRO to unlock full curriculum & certificate."}
                  </p>
                  {!hasFullAccess && (
                    <Link
                      href="/pricing"
                      className="btn btn-sm"
                      style={{ marginTop: "var(--s3)", width: "100%" }}
                    >
                      Upgrade to PRO →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* SIDEBAR CARD 4: Profile & Account Settings Form with Danger Zone */}
          <section className="profile-card p-s5 bg-surface [border:var(--line)] rounded-ledger-lg [box-shadow:var(--shadow-1)]" aria-labelledby="settings-heading">
            <div className={`profile-card-header ${profileCardHeaderClasses}`}>
              <h2 id="settings-heading">
                <Icon name="user" size={20} /> Profile &amp; Settings
              </h2>
              <p>Display information</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitProfileUpdate(inlineFirstName, inlineLinkedinUrl, "inline");
              }}
            >
              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="first-name-input">Display Name</label>
                <p className="profile-form-hint text-ledger-xs text-muted m-[0_0_4px]">Shown on your certificate, leaderboard, and greetings.</p>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="first-name-input"
                    type="text"
                    value={inlineFirstName}
                    maxLength={50}
                    required
                    onChange={(e) => setInlineFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="username-display">Username</label>
                <p className="profile-form-hint text-ledger-xs text-muted m-[0_0_4px]">Unique handle displayed on public leaderboards.</p>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="username-display"
                    type="text"
                    value={`@${username}`}
                    disabled
                    style={{ opacity: 0.7, background: "var(--surface-sunk)" }}
                  />
                </div>
              </div>

              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="linkedin-input">LinkedIn Profile URL</label>
                <p className="profile-form-hint text-ledger-xs text-muted m-[0_0_4px]">
                  Adds a clickable LinkedIn link next to your name on your profile and leaderboard.
                </p>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="linkedin-input"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={inlineLinkedinUrl}
                    onChange={(e) => setInlineLinkedinUrl(e.target.value)}
                  />
                </div>
              </div>

              <button className="btn" type="submit" style={{ width: "100%" }} disabled={savingInline}>
                {savingInline ? "Saving Profile…" : "Save Profile"}
              </button>

              {inlineMsg && (
                <p className={`profile-feedback ${inlineMsg.ok ? "is-success" : "is-error"} mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger`} role="alert">
                  {inlineMsg.text}
                </p>
              )}
            </form>

            {/* Membership Plan Section */}
            <div style={{ marginTop: "var(--s5)", paddingTop: "var(--s4)", borderTop: "1px solid var(--border)" }}>
              <div className="sub-plan-row flex items-center justify-between gap-s4 p-s4 bg-surface-sunk [border:1.5px_solid_var(--ink)]
          rounded-[var(--r-md,_8px)] [box-shadow:2px_2px_0_var(--ink)] mb-s3
          [@media(max-width:580px)]:items-stretch [@media(max-width:580px)]:flex-col">
                <div className="sub-plan-info min-w-0 [flex:1]
          [&_h3]:m-[0_0_4px] [&_h3]:text-[0.98rem] [&_h3]:text-ink
          [&_p]:m-0 [&_p]:text-ledger-xs [&_p]:leading-[1.4] [&_p]:text-text">
                  <h3>{accessLabel}</h3>
                  <p>
                    {isInvited
                      ? `All ${totalLessons} lessons unlocked via invite · Certificate eligible`
                      : isGroupPaid
                      ? `Included with ${groupName ?? "your organization"} · All ${totalLessons} lessons unlocked`
                      : hasFullAccess
                      ? activePeriodEnd
                        ? `${plan ? plan.toUpperCase() : "PRO"} · Renews / ends on ${new Date(activePeriodEnd).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
                        : `All ${totalLessons} lessons unlocked · Certificate access`
                      : `2 free lessons unlocked · Upgrade for all ${totalLessons} lessons & certificate`}
                  </p>
                </div>
                {canCancel && paymentsEnabled ? (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    style={{ fontSize: "var(--fs-xs)" }}
                    onClick={() => setShowCancelModal(true)}
                    disabled={cancellingSub}
                  >
                    {cancellingSub ? "Cancelling…" : "Cancel Plan"}
                  </button>
                ) : !hasFullAccess ? (
                  <Link className="btn" href="/pricing">
                    Upgrade
                  </Link>
                ) : null}
              </div>
              {subMsg && (
                <p className={`profile-feedback ${subMsg.ok ? "is-success" : "is-error"} mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger`} role="status">
                  {subMsg.text}
                </p>
              )}
            </div>

            {/* Danger Zone: Reset Learning Progress */}
            <div className="danger-well mt-s5 p-s4 [background:#fff5f5] [border:1.5px_solid_var(--danger)] rounded-[var(--r-md,_8px)]">
              <h3 className="danger-well-title m-[0_0_4px] text-[0.95rem] font-bold text-danger">Danger Zone</h3>
              <p className="danger-well-desc m-[0_0_var(--s3)] text-text text-ledger-xs leading-[1.45]">
                Clear completed lesson checks and accuracy metrics to practice the curriculum from scratch. Points &amp; leaderboard history are preserved.
              </p>
              <button
                type="button"
                className="btn btn-danger-outline btn-block"
                onClick={() => {
                  setResetError(null);
                  setShowResetModal(true);
                }}
              >
                Reset Learning Progress…
              </button>
            </div>

            {/* Account Sign Out */}
            <div className="signout-row mt-s4 pt-s4 [border-top:1px_solid_var(--border)]">
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button
                  type="submit"
                  className="btn btn-quiet btn-block"
                >
                  <Icon name="logOut" size={16} />
                  Log Out
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* EDIT PROFILE MODAL (Isolated draft state, Escape + Backdrop closes) */}
      {showEditModal && (
        <div
          className="profile-modal-backdrop fixed inset-0 [background:rgba(15,_23,_42,_0.6)] [backdrop-filter:blur(2px)] grid place-items-center z-[100]
          p-s4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !savingModal) setShowEditModal(false);
          }}
        >
          <div className={`profile-modal ${profileModalClasses}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s3)" }}>
              <h3 id="edit-modal-title" style={{ margin: 0 }}>
                Edit Profile
              </h3>
              <button
                type="button"
                className="btn btn-quiet"
                style={{ padding: "4px 8px" }}
                aria-label="Close modal"
                onClick={() => setShowEditModal(false)}
                disabled={savingModal}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitProfileUpdate(modalFirstName, modalLinkedinUrl, "modal");
              }}
            >
              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="modal-name">Display Name</label>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="modal-name"
                    type="text"
                    value={modalFirstName}
                    maxLength={50}
                    required
                    autoFocus
                    onChange={(e) => setModalFirstName(e.target.value)}
                  />
                </div>
              </div>

              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="modal-username">Username</label>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="modal-username"
                    type="text"
                    value={`@${username}`}
                    disabled
                    style={{ opacity: 0.7, background: "var(--surface-sunk)" }}
                  />
                </div>
              </div>

              <div className="profile-form-group grid gap-[6px] mb-s4
          [&_label]:font-bold [&_label]:text-ledger-sm [&_label]:text-ink">
                <label htmlFor="modal-linkedin">LinkedIn Profile URL</label>
                <p className="profile-form-hint text-ledger-xs text-muted m-[0_0_4px]">Shown as a profile link on your profile and public leaderboard.</p>
                <div className={`profile-input-row ${profileInputRowClasses}`}>
                  <input
                    id="modal-linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={modalLinkedinUrl}
                    onChange={(e) => setModalLinkedinUrl(e.target.value)}
                  />
                </div>
              </div>

              {modalMsg && (
                <p className={`profile-feedback ${modalMsg.ok ? "is-success" : "is-error"} mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger`} role="alert">
                  {modalMsg.text}
                </p>
              )}

              <div className="profile-modal-actions flex justify-end gap-s3" style={{ marginTop: "var(--s4)" }}>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={savingModal}>
                  {savingModal ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div
          className="profile-modal-backdrop fixed inset-0 [background:rgba(15,_23,_42,_0.6)] [backdrop-filter:blur(2px)] grid place-items-center z-[100]
          p-s4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resetting) setShowResetModal(false);
          }}
        >
          <div className={`profile-modal ${profileModalClasses}`}>
            <h3 id="modal-title">Reset your learning progress?</h3>
            <p>
              This will clear all completed lesson checks and reset your learning accuracy metrics to zero. You will start fresh on Module 1. Points &amp; leaderboard history are preserved.
            </p>
            {resetError && (
              <p className="profile-feedback is-error mt-[8px] text-ledger-sm font-semibold
          [&.is-success]:text-primary
          [&.is-error]:text-danger" role="alert" style={{ marginBottom: "var(--s3)" }}>
                {resetError}
              </p>
            )}
            <div className="profile-modal-actions flex justify-end gap-s3">
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
                className="btn btn-danger"
                onClick={handleResetProgress}
                disabled={resetting}
              >
                {resetting ? "Resetting…" : "Yes, reset my progress"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SUBSCRIPTION CONFIRMATION MODAL */}
      {showCancelModal && (
        <div
          className="profile-modal-backdrop fixed inset-0 [background:rgba(15,_23,_42,_0.6)] [backdrop-filter:blur(2px)] grid place-items-center z-[100]
          p-s4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !cancellingSub) setShowCancelModal(false);
          }}
        >
          <div className={`profile-modal ${profileModalClasses}`}>
            <h3 id="cancel-modal-title">Cancel PRO subscription?</h3>
            <p>
              You will keep full access to all {totalLessons} lessons and your certificate until the end of your current billing period.
            </p>
            <div className="profile-modal-actions flex justify-end gap-s3">
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => setShowCancelModal(false)}
                disabled={cancellingSub}
              >
                Keep Plan
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCancelSubscription}
                disabled={cancellingSub}
              >
                {cancellingSub ? "Cancelling…" : "Yes, Cancel Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
