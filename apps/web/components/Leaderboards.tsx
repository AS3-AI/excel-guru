"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/leaderboard";

type Data = { entries: LeaderboardEntry[]; you: { value: number; label: string; copy?: string } | null; signedIn: boolean };
type BoardProps = { type: "points" | "streak"; title?: string };

export function Leaderboards({ type, title }: BoardProps) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/leaderboard?type=${type}`, { cache: "no-store" });
      if (!response.ok) throw new Error("leaderboard unavailable");
      setData(await response.json() as Data);
      setFailed(false);
    } catch { setFailed(true); }
  }, [type]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("excelguru:progress-saved", refresh);
    window.addEventListener("excelguru:share-bonus", refresh);
    return () => {
      window.removeEventListener("excelguru:progress-saved", refresh);
      window.removeEventListener("excelguru:share-bonus", refresh);
    };
  }, [load]);
  const heading = title ?? (type === "points" ? "Today’s High Scores" : "Today’s High Streaks");
  return <section className="leaderboard-card" aria-live="polite">
    <h2>{heading}</h2>
    {failed ? <p>Leaderboard unavailable right now.</p> : !data ? <p>Loading leaderboard…</p> : <>
      {data.entries.length ? <ol className="leaderboard-list">{data.entries.map((entry) => <li key={`${entry.username}-${entry.rank}`}><span className="leaderboard-rank">{entry.rank}.</span><span className="leaderboard-name">{entry.firstName} <small>@{entry.username}</small></span><strong>{entry.value}{type === "streak" ? " days" : " pts"}</strong>{entry.linkedinUrl && <a href={entry.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`LinkedIn profile for ${entry.firstName}`}>LinkedIn</a>}</li>)}</ol> : <p>No scores yet today.</p>}
      {data.you && <p className="leaderboard-you"><strong>you: {data.you.value}{type === "streak" ? " days" : " points today"}</strong></p>}
      {type === "streak" && data.you?.copy && <p className="leaderboard-copy">{data.you.copy}</p>}
      {!data.signedIn && <p>Log in to appear on the leaderboard.</p>}
    </>}
  </section>;
}
