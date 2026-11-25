import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIstDate, getIstDayUtcBounds } from "@/lib/progress";
import {
  currentStreakForOffset,
  leaderboardColumns,
  rankEntries,
  safeLinkedInUrl,
  streakCopy,
  topThree,
  youLine,
  type LeaderboardCandidate,
} from "@/lib/leaderboard";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (type !== "points" && type !== "streak")
    return NextResponse.json({ error: "Invalid leaderboard type" }, { status: 400 });
  const session = await createClient();
  const {
    data: { user },
  } = session ? await session.auth.getUser() : { data: { user: null } };
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Leaderboard unavailable" }, { status: 503 });
  const view = type === "points" ? "leaderboard_points_today" : "leaderboard_streaks_today";
  const now = new Date();
  const bounds = getIstDayUtcBounds(now);
  const today = getIstDate(now);
  const [board, ownPoints, ownStreak, profile] = await Promise.all([
    admin
      .from(view)
      .select(leaderboardColumns(type))
      .lte("rank", 3)
      .order("rank", { ascending: true }),
    user && type === "points"
      ? admin
          .from("points_log")
          .select("points")
          .eq("user_id", user.id)
          .gte("created_at", bounds.start)
          .lt("created_at", bounds.end)
      : Promise.resolve({ data: [], error: null }),
    user && type === "streak"
      ? admin
          .from("streaks")
          .select("current,last_active_date")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? admin.from("profiles").select("shared_on_linkedin").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (board.error || ownPoints.error || ownStreak.error || profile.error)
    return NextResponse.json({ error: "Leaderboard unavailable" }, { status: 500 });
  const boardRows = (board.data ?? []) as unknown as Array<{
    username: string;
    first_name: string;
    linkedin_url: string | null;
    points?: number;
    streak?: number;
  }>;
  const rows: LeaderboardCandidate[] = boardRows.map((row) => ({
    username: row.username,
    firstName: row.first_name,
    value: type === "points" ? (row.points ?? 0) : (row.streak ?? 0),
    linkedinUrl: safeLinkedInUrl(row.linkedin_url),
  }));
  const entries = topThree(rankEntries(rows));
  const pointsToday = (ownPoints.data ?? []).reduce((sum, row) => sum + row.points, 0);
  let yours = null;
  if (user && type === "points") yours = youLine(pointsToday, true);
  if (user && type === "streak") {
    const current = ownStreak.data?.current ?? 0;
    const last = ownStreak.data?.last_active_date;
    const yesterday = new Date(`${today}T00:00:00+05:30`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayText = getIstDate(yesterday);
    const offset = last === today ? 0 : last === yesterdayText ? 1 : 2;
    const activeCurrent = currentStreakForOffset(current, offset);
    yours = { value: activeCurrent, label: "you", copy: streakCopy(activeCurrent, offset, true) };
  }
  return NextResponse.json({
    type,
    entries,
    you: yours,
    signedIn: !!user,
    shareBonusAvailable: !!user && !!profile.data && profile.data.shared_on_linkedin !== true,
  });
}
