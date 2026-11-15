"use client";

import { useEffect, useState } from "react";

export function ShareBonus({ signedIn }: { signedIn: boolean }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!signedIn) return;
    void fetch("/api/leaderboard?type=points", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setAvailable((await response.json() as { shareBonusAvailable?: boolean }).shareBonusAvailable === true);
    }).catch(() => {});
  }, [signedIn]);
  if (!signedIn || !available) return null;
  const share = async () => {
    setBusy(true);
    setMessage("");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer");
    try {
      const response = await fetch("/api/share-bonus", { method: "POST" });
      if (response.status === 409) { setAvailable(false); return; }
      if (!response.ok) throw new Error("Share bonus unavailable");
      setAvailable(false);
      setMessage("+500 points added!");
      window.dispatchEvent(new Event("excelguru:share-bonus"));
    } catch { setMessage("Could not add the share bonus. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className="share-bonus-card"><h2>Share on LinkedIn for +500 points</h2><button className="btn" type="button" disabled={busy} onClick={() => void share()}>{busy ? "Adding points…" : "Share on LinkedIn"}</button>{message && <p role="status">{message}</p>}</section>;
}
