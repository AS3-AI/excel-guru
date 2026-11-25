export type LeaderboardEntry = { username: string; firstName: string; value: number; rank: number; linkedinUrl: string | null };
export type LeaderboardCandidate = Omit<LeaderboardEntry, "rank">;
export type LeaderboardType = "points" | "streak";

export function leaderboardColumns(type: LeaderboardType): string {
  return type === "points"
    ? "username,first_name,linkedin_url,points,rank"
    : "username,first_name,linkedin_url,streak,rank";
}

export function rankEntries(rows: readonly LeaderboardCandidate[]): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.username.localeCompare(b.username));
  let previous: number | undefined;
  let rank = 0;
  return sorted.map((row, index) => {
    if (row.value !== previous) rank = index + 1;
    previous = row.value;
    return { ...row, rank };
  });
}

export function topThree(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.filter((entry) => entry.rank <= 3);
}

export function youLine(value: number, signedIn: boolean): { label: "you"; value: number } | null {
  return signedIn ? { label: "you", value } : null;
}

export function streakCopy(current: number, lastActiveDayOffset: number, signedIn: boolean): string {
  if (!signedIn || current <= 0 || lastActiveDayOffset > 1) return "Complete a lesson today to start your streak!";
  if (lastActiveDayOffset === 0) return "Complete a lesson tomorrow to increase your streak!";
  return `Complete a lesson today to reach ${current + 1} days!`;
}

export function currentStreakForOffset(current: number, lastActiveDayOffset: number | null): number {
  return lastActiveDayOffset === null || lastActiveDayOffset >= 2 ? 0 : current;
}

export function answerPointsVisible(signedIn: boolean): boolean { return signedIn; }

export function shareBonusDecision(sharedOnLinkedIn: boolean | null | undefined): "grant" | "already-shared" {
  return sharedOnLinkedIn ? "already-shared" : "grant";
}

export function safeLinkedInUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) ? url.toString() : null;
  } catch { return null; }
}

export async function claimShareBonus(
  authenticated: boolean,
  db: { getClaimed(): Promise<boolean>; claim(): Promise<boolean> },
): Promise<{ status: 401 | 409 | 200 }> {
  if (!authenticated) return { status: 401 };
  if (await db.getClaimed()) return { status: 409 };
  return await db.claim() ? { status: 200 } : { status: 409 };
}
