import { describe, expect, it } from "vitest";
import { rankEntries, topThree, youLine, streakCopy, shareBonusDecision, safeLinkedInUrl, leaderboardColumns, currentStreakForOffset, answerPointsVisible, claimShareBonus, type LeaderboardEntry } from "./leaderboard";

const entries: LeaderboardEntry[] = [
  { username: "ada", firstName: "Ada", value: 100, rank: 1, linkedinUrl: null },
  { username: "bea", firstName: "Bea", value: 100, rank: 1, linkedinUrl: null },
  { username: "cy", firstName: "Cy", value: 80, rank: 3, linkedinUrl: null },
  { username: "dee", firstName: "Dee", value: 70, rank: 4, linkedinUrl: null },
];

describe("leaderboard pure logic", () => {
  it("ranks values descending with shared ranks", () => expect(rankEntries(entries.map(({ username, firstName, value, linkedinUrl }) => ({ username, firstName, value, linkedinUrl })))).toEqual(entries));
  it("keeps competition ranking after a tie", () => expect(rankEntries([{ username: "a", firstName: "A", value: 9, linkedinUrl: null }, { username: "b", firstName: "B", value: 9, linkedinUrl: null }, { username: "c", firstName: "C", value: 1, linkedinUrl: null }]).map((x) => x.rank)).toEqual([1, 1, 3]));
  it("sorts before ranking", () => expect(rankEntries([{ username: "b", firstName: "B", value: 1, linkedinUrl: null }, { username: "a", firstName: "A", value: 8, linkedinUrl: null }]).map((x) => x.username)).toEqual(["a", "b"]));
  it("uses a stable name order for tied values", () => expect(rankEntries([{ username: "z", firstName: "Z", value: 1, linkedinUrl: null }, { username: "a", firstName: "A", value: 1, linkedinUrl: null }]).map((x) => x.username)).toEqual(["a", "z"]));
  it("cuts at top 3 ranks while retaining ties", () => expect(topThree(entries).map((x) => x.username)).toEqual(["ada", "bea", "cy"]));
  it("returns an empty board", () => expect(topThree([])).toEqual([]));
  it("does not mutate source entries", () => { const source = [...entries].reverse(); topThree(source); expect(source[0]?.username).toBe("dee"); });
  it("shows signed-in you line with zero today", () => expect(youLine(0, true)).toEqual({ value: 0, label: "you" }));
  it("shows signed-in you line with points", () => expect(youLine(125, true)).toEqual({ value: 125, label: "you" }));
  it("omits you line when signed out", () => expect(youLine(0, false)).toBeNull());
  it("uses start streak copy", () => expect(streakCopy(0, 0, false)).toBe("Complete a lesson today to start your streak!"));
  it("uses target streak copy for active yesterday", () => expect(streakCopy(3, 1, true)).toBe("Complete a lesson today to reach 4 days!"));
  it("uses tomorrow streak copy when active today", () => expect(streakCopy(3, 0, true)).toBe("Complete a lesson tomorrow to increase your streak!"));
  it("decides a share bonus can be granted once", () => expect(shareBonusDecision(false)).toBe("grant"));
  it("decides an existing share bonus is a conflict", () => expect(shareBonusDecision(true)).toBe("already-shared"));
  it("treats missing profile as eligible for a first bonus", () => expect(shareBonusDecision(null)).toBe("grant"));
  it("selects only columns present in each leaderboard view", () => {
    const pointsViewColumns = ["user_id", "username", "first_name", "linkedin_url", "points", "rank"];
    const streakViewColumns = ["user_id", "username", "first_name", "linkedin_url", "streak", "rank"];
    expect(leaderboardColumns("points").split(",").every((column) => pointsViewColumns.includes(column))).toBe(true);
    expect(leaderboardColumns("streak").split(",").every((column) => streakViewColumns.includes(column))).toBe(true);
    expect(leaderboardColumns("points")).not.toContain("streak");
    expect(leaderboardColumns("streak")).not.toContain("points");
  });
  it.each([[0, 8], [1, 8], [2, 0], [4, 0], [null, 0]] as const)("uses current streak for offset %s", (offset, expected) => expect(currentStreakForOffset(8, offset)).toBe(expected));
  it("only shows answer points when signed in", () => {
    expect(answerPointsVisible(true)).toBe(true);
    expect(answerPointsVisible(false)).toBe(false);
  });
  it.each(["javascript:alert(1)", "http://linkedin.com/in/a", "https://evil.com/in/a", "not a url"]) ("rejects unsafe LinkedIn URL %s", (value) => expect(safeLinkedInUrl(value)).toBeNull());
  it("accepts LinkedIn host and subdomain URLs", () => {
    expect(safeLinkedInUrl("https://linkedin.com/in/a")).toBe("https://linkedin.com/in/a");
    expect(safeLinkedInUrl("https://www.linkedin.com/in/a")).toBe("https://www.linkedin.com/in/a");
  });
  it("returns 401, 409, and claims the share bonus once", async () => {
    const calls: string[] = [];
    let claimed = false;
    const db = { getClaimed: async () => claimed, claim: async () => { calls.push("claim"); if (claimed) return false; claimed = true; return true; } };
    expect(await claimShareBonus(false, db)).toEqual({ status: 401 });
    expect(await claimShareBonus(true, { getClaimed: async () => true, claim: db.claim })).toEqual({ status: 409 });
    expect(await claimShareBonus(true, db)).toEqual({ status: 200 });
    expect(await claimShareBonus(true, db)).toEqual({ status: 409 });
    expect(calls).toEqual(["claim"]);
  });
});
