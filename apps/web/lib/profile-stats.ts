import { MODULES } from "./modules";
import { getIstDate } from "./dates";

export type ModuleProgressItem = {
  slug: string;
  title: string;
  order: number;
  done: number;
  total: number;
  pct: number;
};

export type AccuracySummary = {
  hasData: boolean;
  averagePct: number;
  perfectCount: number;
  tier: { label: string; desc: string };
};

export type LeagueTier = {
  name: "Bronze" | "Silver" | "Gold" | "Emerald" | "Diamond";
  colorClass: "is-league" | "is-xp" | "is-rank";
  desc: string;
  nextName: string | null;
  pointsToNext: number;
};

export type WeeklyDay = {
  date: string;
  dayLabel: string;
  points: number;
  isToday: boolean;
};

export type RecentLessonItem = {
  id: string;
  title: string;
  module: string;
  completedAt: string;
  accuracyPct: number;
  timesCompleted: number;
};

export type LessonProgressInput = {
  lesson_id: string;
  completed_at: string;
  first_try_accuracy: number | null;
  times_completed?: number;
};

export type LessonMeta = {
  id: string;
  title: string;
  module: string;
};

/**
 * Computes per-module completion using module slugs (matching lesson.module JSON values)
 * rather than display titles with spaces.
 */
export function computeModuleBreakdown(
  order: readonly string[],
  lessonsById: ReadonlyMap<string, LessonMeta>,
  completedIds: readonly string[],
): ModuleProgressItem[] {
  const completed = new Set(completedIds);
  return MODULES.map((mod) => {
    const modLessons = order.filter((id) => lessonsById.get(id)?.module.toLowerCase() === mod.slug);
    const total = modLessons.length > 0 ? modLessons.length : mod.total;
    const done = modLessons.filter((id) => completed.has(id)).length;
    return {
      slug: mod.slug,
      title: mod.title,
      order: mod.order,
      done,
      total,
      pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
    };
  });
}

/**
 * Picks up to `limit` featured modules: prioritizes modules the learner has started/finished,
 * then fills remaining slots with foundational modules.
 */
export function pickFeaturedModules(breakdown: readonly ModuleProgressItem[], limit = 4): ModuleProgressItem[] {
  const started = breakdown.filter((m) => m.done > 0);
  const untouched = breakdown.filter((m) => m.done === 0);
  return [...started, ...untouched].slice(0, limit);
}

/**
 * Honest first-try accuracy metrics: returns `hasData: false` and `averagePct: 0` when no
 * lessons have been completed yet instead of falsely claiming 100%.
 */
export function computeAccuracySummary(progressRows: readonly LessonProgressInput[]): AccuracySummary {
  const accuracies = progressRows
    .map((r) => r.first_try_accuracy)
    .filter((a): a is number => typeof a === "number" && Number.isFinite(a));

  if (accuracies.length === 0) {
    return {
      hasData: false,
      averagePct: 0,
      perfectCount: 0,
      tier: { label: "Starter", desc: "Complete your first lesson to measure learning rate" },
    };
  }

  const averagePct = Math.round((accuracies.reduce((sum, val) => sum + val, 0) / accuracies.length) * 100);
  const perfectCount = accuracies.filter((a) => a >= 0.99).length;

  const tier =
    averagePct >= 90
      ? { label: "Mastery", desc: "Top-tier formula precision on first try" }
      : averagePct >= 75
      ? { label: "Proficient", desc: "Strong retention with few formula syntax errors" }
      : averagePct >= 50
      ? { label: "Practitioner", desc: "Steady progress across formula categories" }
      : { label: "Developing", desc: "Building formula intuition and muscle memory" };

  return { hasData: true, averagePct, perfectCount, tier };
}

/**
 * Calculates league tier purely from earned XP so new accounts start in Bronze and progress naturally.
 */
export function computeLeagueTier(totalPoints: number): LeagueTier {
  if (totalPoints >= 3000) {
    return {
      name: "Diamond",
      colorClass: "is-rank",
      desc: "Top-tier formula prowess",
      nextName: null,
      pointsToNext: 0,
    };
  }
  if (totalPoints >= 1500) {
    return {
      name: "Emerald",
      colorClass: "is-rank",
      desc: "Advanced formula mastery",
      nextName: "Diamond",
      pointsToNext: 3000 - totalPoints,
    };
  }
  if (totalPoints >= 600) {
    return {
      name: "Gold",
      colorClass: "is-xp",
      desc: "Strong formula retention",
      nextName: "Emerald",
      pointsToNext: 1500 - totalPoints,
    };
  }
  if (totalPoints >= 150) {
    return {
      name: "Silver",
      colorClass: "is-league",
      desc: "Consistent formula learner",
      nextName: "Gold",
      pointsToNext: 600 - totalPoints,
    };
  }
  return {
    name: "Bronze",
    colorClass: "is-league",
    desc: "Formula apprentice",
    nextName: "Silver",
    pointsToNext: Math.max(0, 150 - totalPoints),
  };
}

/**
 * Aggregates points_log rows across the last 7 IST calendar days ending at `now`.
 */
export function computeWeeklyActivity(
  pointsRows: readonly { points: number; created_at: string }[],
  now: Date,
): WeeklyDay[] {
  const todayIst = getIstDate(now);
  const byDay = new Map<string, number>();

  for (const row of pointsRows) {
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const istDay = getIstDate(created);
    byDay.set(istDay, (byDay.get(istDay) ?? 0) + row.points);
  }

  const days: WeeklyDay[] = [];
  const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  const baseMidnightIst = new Date(`${todayIst}T00:00:00+05:30`);

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(baseMidnightIst.getTime() - offset * 24 * 60 * 60 * 1000);
    const date = getIstDate(d);
    days.push({
      date,
      dayLabel: offset === 0 ? "Today" : weekdayFmt.format(d),
      points: byDay.get(date) ?? 0,
      isToday: offset === 0,
    });
  }
  return days;
}

/**
 * Returns the N most recently completed lessons enriched with lesson title and module slug.
 */
export function buildRecentActivity(
  progressRows: readonly LessonProgressInput[],
  lessonsById: ReadonlyMap<string, LessonMeta>,
  limit = 5,
): RecentLessonItem[] {
  return [...progressRows]
    .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
    .slice(0, limit)
    .flatMap((row) => {
      const meta = lessonsById.get(row.lesson_id);
      if (!meta) return [];
      return [
        {
          id: meta.id,
          title: meta.title,
          module: meta.module,
          completedAt: row.completed_at,
          accuracyPct: Math.round((row.first_try_accuracy ?? 0) * 100),
          timesCompleted: row.times_completed ?? 1,
        },
      ];
    });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates a crisp Neobrutalist Excel Guru SVG certificate ready for download or printing.
 */
export function renderCertificateSvg(input: {
  recipientName: string;
  credentialId: string;
  issuedAtIso: string;
  totalLessons: number;
  verifyUrl: string;
}): string {
  const safeName = escapeXml(input.recipientName);
  const safeId = escapeXml(input.credentialId);
  const safeUrl = escapeXml(input.verifyUrl);
  const formattedDate = new Date(input.issuedAtIso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="840" viewBox="0 0 1200 840" role="img" aria-label="Excel Guru Certificate of Mastery for ${safeName}">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e3e1da" stroke-width="1" />
    </pattern>
  </defs>
  <rect width="1200" height="840" fill="#faf9f6" />
  <rect width="1200" height="840" fill="url(#grid)" />

  <!-- Outer Neobrutalist Card Shadow & Frame -->
  <rect x="64" y="64" width="1080" height="720" rx="14" fill="#14201a" />
  <rect x="52" y="52" width="1080" height="720" rx="14" fill="#ffffff" stroke="#14201a" stroke-width="4" />

  <!-- Top Mint Accent Strip -->
  <rect x="54" y="54" width="1076" height="84" rx="12" fill="#c9f2c2" />
  <line x1="52" y1="138" x2="1132" y2="138" stroke="#14201a" stroke-width="3" />

  <!-- Brand Mark -->
  <rect x="96" y="74" width="44" height="44" rx="8" fill="#107c41" stroke="#14201a" stroke-width="2.5" />
  <text x="118" y="103" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-style="italic" font-weight="700" font-size="22" fill="#ffffff">fx</text>
  <text x="156" y="104" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="800" font-size="26" fill="#14201a">Excel Guru</text>

  <!-- Credential Pill -->
  <rect x="820" y="77" width="272" height="38" rx="19" fill="#fdf5b0" stroke="#14201a" stroke-width="2" />
  <text x="956" y="101" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#14201a">ID: ${safeId}</text>

  <!-- Certificate Heading -->
  <text x="592" y="220" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="16" letter-spacing="4" fill="#107c41">CERTIFICATE OF FORMULA MASTERY</text>
  <text x="592" y="268" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="600" font-size="22" fill="#5f6963">This certifies that</text>

  <!-- Recipient Name -->
  <text x="592" y="360" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="800" font-size="60" fill="#14201a">${safeName}</text>
  <line x1="250" y1="388" x2="934" y2="388" stroke="#14201a" stroke-width="3" />

  <!-- Achievement Copy -->
  <text x="592" y="448" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="500" font-size="22" fill="#29332d">has successfully completed all ${input.totalLessons} interactive spreadsheet lessons</text>
  <text x="592" y="484" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="500" font-size="22" fill="#29332d">covering SUM, Logical, Lookup, Index/Match, Dynamic Arrays, and Shortcuts.</text>

  <!-- Formula Pill Row -->
  <rect x="260" y="532" width="144" height="38" rx="19" fill="#c9f2c2" stroke="#14201a" stroke-width="2" />
  <text x="332" y="556" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#14201a">=SUM()</text>
  <rect x="424" y="532" width="156" height="38" rx="19" fill="#fdf5b0" stroke="#14201a" stroke-width="2" />
  <text x="502" y="556" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#14201a">=XLOOKUP()</text>
  <rect x="600" y="532" width="176" height="38" rx="19" fill="#cdc6ff" stroke="#14201a" stroke-width="2" />
  <text x="688" y="556" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#14201a">=INDEX/MATCH</text>
  <rect x="796" y="532" width="136" height="38" rx="19" fill="#c4e4ff" stroke="#14201a" stroke-width="2" />
  <text x="864" y="556" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#14201a">=FILTER()</text>

  <!-- Footer Signature & Verification -->
  <line x1="96" y1="636" x2="1088" y2="636" stroke="#e3e1da" stroke-width="2" />
  <text x="96" y="676" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#5f6963">ISSUED ON</text>
  <text x="96" y="706" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700" font-size="20" fill="#14201a">${escapeXml(formattedDate)}</text>

  <text x="592" y="676" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="14" fill="#5f6963">VERIFICATION LINK</text>
  <text x="592" y="706" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="600" font-size="15" fill="#107c41">${safeUrl}</text>

  <!-- Seal -->
  <circle cx="1028" cy="692" r="44" fill="#107c41" stroke="#14201a" stroke-width="3" />
  <text x="1028" y="688" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="800" font-size="13" fill="#ffffff">VERIFIED</text>
  <text x="1028" y="706" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700" font-size="11" fill="#c9f2c2">100% DONE</text>
</svg>`;
}
