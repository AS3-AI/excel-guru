"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { rankLabel } from "@/lib/leaderboard";

type YouStanding = { value: number; label: string; copy?: string; rank?: number | null };
type LeaderboardResponse = { you: YouStanding | null; signedIn: boolean };
type Standing = { rank: number | null; points: number; streak: number };

export function LeaderboardRank() {
  const [standing, setStanding] = useState<Standing | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const [pointsResponse, streakResponse] = await Promise.all([
        fetch("/api/leaderboard?type=points", { cache: "no-store" }),
        fetch("/api/leaderboard?type=streak", { cache: "no-store" }),
      ]);
      if (!pointsResponse.ok || !streakResponse.ok) throw new Error("leaderboard unavailable");
      const [pointsData, streakData] = (await Promise.all([
        pointsResponse.json(),
        streakResponse.json(),
      ])) as [LeaderboardResponse, LeaderboardResponse];
      if (requestId !== requestIdRef.current) return;
      if (!pointsData.signedIn || !streakData.signedIn || !pointsData.you || !streakData.you) {
        setStanding(null);
        return;
      }
      setStanding({
        rank: pointsData.you.rank ?? null,
        points: pointsData.you.value,
        streak: streakData.you.value,
      });
    } catch {
      if (requestId === requestIdRef.current) setStanding(null);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current++;
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };
    window.addEventListener("excelguru:progress-saved", refresh);
    window.addEventListener("excelguru:share-bonus", refresh);
    window.addEventListener("excelguru:profile-updated", refresh);
    return () => {
      window.removeEventListener("excelguru:progress-saved", refresh);
      window.removeEventListener("excelguru:share-bonus", refresh);
      window.removeEventListener("excelguru:profile-updated", refresh);
    };
  }, [load]);

  if (!standing) return null;

  return (
    <Link
      href="/profile"
      aria-label="Your leaderboard standing"
      aria-live="polite"
      className="inline-flex flex-wrap items-center gap-x-[6px] gap-y-[2px] min-w-0 font-ledger-code text-ledger-sm text-muted no-underline hover:text-ink hover:underline"
    >
      <span className="inline-flex items-center gap-[4px] whitespace-nowrap">
        <Icon name="trophy" size={14} className="shrink-0" />
        <span>{rankLabel(standing.rank)}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span className="num whitespace-nowrap">{standing.points} pts</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-[4px] whitespace-nowrap">
        <Icon name="flame" size={14} className="shrink-0" />
        <span className="num">
          {standing.streak} {standing.streak === 1 ? "day" : "days"}
        </span>
      </span>
    </Link>
  );
}
