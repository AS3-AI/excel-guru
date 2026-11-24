// GitHub-style activity graph: one cell per day for the last N weeks, shaded by lessons completed that day.
// Days are counted in IST (the product's day boundary), so server and client render the same grid.
// ponytail: fed from lesson_progress.completed_at (latest completion per lesson), so repeats of a lesson count once;
// switch the source to lesson_completions if repeat practice should show up.
import type { CSSProperties } from "react";

const DAY = 86_400_000;
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
const longFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const istKey = (d: Date) => fmt.format(d); // YYYY-MM-DD

export function activityStats(dates: readonly string[], now = new Date()) {
  const counts = new Map<string, number>();
  for (const iso of dates) { const t = Date.parse(iso); if (Number.isFinite(t)) { const k = istKey(new Date(t)); counts.set(k, (counts.get(k) ?? 0) + 1); } }
  // Current run of active days, ending today or (if nothing yet today) yesterday.
  let streak = 0;
  let cursor = counts.has(istKey(now)) ? now.getTime() : now.getTime() - DAY;
  while (counts.has(istKey(new Date(cursor)))) { streak++; cursor -= DAY; }
  return { counts, streak };
}

export function ActivityGraph({ dates, weeks = 20, title = "Your activity", now = new Date() }: { dates: readonly string[]; weeks?: number; title?: string; now?: Date }) {
  const { counts, streak } = activityStats(dates, now);
  // Weekday of "today" in IST (0 = Sunday) decides where the last column ends.
  const todayKey = istKey(now);
  const todayDow = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const start = now.getTime() - (weeks * 7 - 1 - (6 - todayDow)) * DAY;
  const cells: { key: string; n: number; future: boolean; date: Date }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(start + i * DAY);
    const key = istKey(date);
    cells.push({ key, n: counts.get(key) ?? 0, future: date.getTime() > now.getTime() && key !== todayKey, date });
  }
  const total = cells.reduce((sum, c) => sum + c.n, 0);
  const months = Array.from({ length: weeks }, (_, w) => {
    const first = cells[w * 7]!.date;
    const prev = w > 0 ? cells[(w - 1) * 7]!.date : null;
    return !prev || monthFmt.format(first) !== monthFmt.format(prev) ? monthFmt.format(first) : "";
  });
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);

  return (
    <section className="activity" aria-label={title}>
      <header className="activity-head">
        <h2>{title}</h2>
        <p><b className="num">{total}</b> lesson{total === 1 ? "" : "s"} in {weeks} weeks · <b className="num">{streak}</b>-day run</p>
      </header>
      <div className="activity-scroll">
        <div className="activity-grid" style={{ "--weeks": weeks } as CSSProperties} role="img" aria-label={`${total} lessons completed in the last ${weeks} weeks; current run ${streak} days`}>
          <div className="activity-months" aria-hidden="true">{months.map((m, w) => <span key={w}>{m}</span>)}</div>
          <div className="activity-days" aria-hidden="true"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
          <div className="activity-cells" aria-hidden="true">
            {cells.map((c, i) => (
              <i key={c.key} className={`lv${level(c.n)}${c.key === todayKey ? " is-today" : ""}${c.future ? " is-future" : ""}`}
                style={{ "--c": Math.floor(i / 7), "--r": i % 7 } as CSSProperties}
                title={c.future ? undefined : `${c.n} lesson${c.n === 1 ? "" : "s"} on ${longFmt.format(c.date)}`} />
            ))}
          </div>
        </div>
      </div>
      <footer className="activity-legend" aria-hidden="true">Less<i className="lv0" /><i className="lv1" /><i className="lv2" /><i className="lv3" /><i className="lv4" />More</footer>
    </section>
  );
}
