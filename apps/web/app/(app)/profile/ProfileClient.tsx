"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type ProfileClientProps = {
  initialFirstName: string;
  username: string;
  email: string | null;
  initialLinkedInUrl: string | null;
  sharedOnLinkedIn: boolean;
  isPremium: boolean;
  plan: string | null;
  periodEnd: string | null;
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
}: ProfileClientProps) {
  const router = useRouter();

  // Profile fields state
  const [firstName, setFirstName] = useState(initialFirstName);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedInUrl ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Share bonus state
  const [shared, setShared] = useState(initialShared);
  const [claimingShare, setClaimingShare] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Reset progress modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Cancel subscription state
  const [cancellingSub, setCancellingSub] = useState(false);
  const [subMsg, setSubMsg] = useState<string | null>(null);
  const [activePeriodEnd, setActivePeriodEnd] = useState(periodEnd);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setProfileMsg({ text: data.error ?? "Failed to update profile", ok: false });
      } else {
        setProfileMsg({ text: "Profile updated successfully!", ok: true });
        router.refresh();
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

    // Open share window
    const shareUrl = encodeURIComponent("https://excelguru.app");
    const text = encodeURIComponent("I'm learning Excel formulas interactively on Excel Guru! Real spreadsheet in the browser. 📊");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&summary=${text}`, "_blank", "width=600,height=600");

    try {
      const res = await fetch("/api/share-bonus", { method: "POST" });
      const data = await res.json() as { points?: number; error?: string };
      if (res.ok) {
        setShared(true);
        setShareMsg("+500 points awarded for sharing!");
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
      const data = await res.json() as { ok?: boolean; endsAt?: string | null; error?: string };
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

  return (
    <>
      {/* Profile Settings Card */}
      <section className="profile-card" aria-labelledby="settings-heading">
        <div className="profile-card-header">
          <h2 id="settings-heading"><Icon name="user" size={20} />Profile &amp; Leaderboard Settings</h2>
          <p>Public display info</p>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="profile-form-group">
            <label htmlFor="first-name-input">First Name</label>
            <p className="profile-form-hint">Shown on your certificate and dashboard greeting.</p>
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
              Adding your LinkedIn link shows a clickable profile tag next to your name on the leaderboard.
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
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {profileMsg && (
            <p className={`profile-feedback ${profileMsg.ok ? "is-success" : "is-error"}`} role="alert">
              {profileMsg.text}
            </p>
          )}
        </form>
      </section>

      {/* Share Bonus Card */}
      <section className="profile-card" aria-labelledby="share-bonus-heading">
        <div className="profile-card-header">
          <h2 id="share-bonus-heading"><Icon name="sparkle" size={20} />LinkedIn Share Bonus</h2>
          <span className="badge">+500 PTS</span>
        </div>
        <p style={{ margin: "0 0 var(--s4)", color: "var(--text)", fontSize: "var(--fs-sm)" }}>
          Share your Excel learning progress on LinkedIn and get 500 bonus points credited instantly toward today&apos;s leaderboard.
        </p>
        {shared ? (
          <p className="profile-feedback is-success" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="check" size={16} /> Bonus claimed! Thank you for sharing Excel Guru.
          </p>
        ) : (
          <button className="btn" onClick={handleShareBonus} disabled={claimingShare}>
            <Icon name="externalLink" size={16} />
            {claimingShare ? "Claiming…" : "Share on LinkedIn (+500 pts)"}
          </button>
        )}
        {shareMsg && !shared && <p className="profile-feedback is-error">{shareMsg}</p>}
      </section>

      {/* Subscription Card */}
      <section className="profile-card" aria-labelledby="sub-heading">
        <div className="profile-card-header">
          <h2 id="sub-heading"><Icon name="award" size={20} />Membership Plan</h2>
          <span className={`profile-badge ${isPremium ? "is-pro" : "is-free"}`}>
            {isPremium ? "PRO Active" : "Free Plan"}
          </span>
        </div>

        <div className="sub-plan-row">
          <div className="sub-plan-info">
            <h3>{isPremium ? `${plan ? plan.toUpperCase() : "PRO"} Membership` : "Free Tier"}</h3>
            <p>
              {isPremium
                ? activePeriodEnd
                  ? `Renews / ends on ${new Date(activePeriodEnd).toLocaleDateString()}`
                  : "All 86 lessons unlocked · Certificate access"
                : "2 free lessons unlocked · Upgrade for all 86 lessons & certificate"}
            </p>
          </div>
          {isPremium ? (
            <button
              className="btn btn-quiet"
              style={{ fontSize: "var(--fs-xs)" }}
              onClick={handleCancelSubscription}
              disabled={cancellingSub}
            >
              {cancellingSub ? "Cancelling…" : "Cancel Plan"}
            </button>
          ) : (
            <Link className="btn" href="/pricing">Upgrade to PRO</Link>
          )}
        </div>
        {subMsg && <p className="profile-feedback" style={{ color: "var(--ink)" }}>{subMsg}</p>}
      </section>

      {/* Danger Zone: Reset Progress */}
      <section className="profile-card danger-zone-card" aria-labelledby="danger-heading">
        <div className="profile-card-header">
          <h2 id="danger-heading"><Icon name="x" size={20} />Danger Zone</h2>
          <p>Reset data</p>
        </div>
        <p style={{ margin: "0 0 var(--s4)", color: "var(--text)", fontSize: "var(--fs-sm)" }}>
          Clear your completed lesson checks and accuracy stats so you can practice the entire curriculum from scratch. (Leaderboard history and earned points are kept).
        </p>
        <button
          className="btn"
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          onClick={() => setShowResetModal(true)}
        >
          Reset Learning Progress…
        </button>
      </section>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="profile-modal">
            <h3 id="modal-title">Reset your learning progress?</h3>
            <p>
              This will clear all completed lesson checks and reset your learning accuracy metrics to zero. You will start fresh on Module 1. This action cannot be undone.
            </p>
            <div className="profile-modal-actions">
              <button
                className="btn btn-quiet"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
              >
                Cancel
              </button>
              <button
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
