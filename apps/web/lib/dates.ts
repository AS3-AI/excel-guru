export function getIstDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getIstDayUtcBounds(now: Date): { start: string; end: string } {
  const [year, month, day] = getIstDate(now).split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!) - 5.5 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}
