// Calendar grid math, in the browser's local time zone. Days are built with
// `new Date(y, m, d)` (local midnight), never by adding 24h, so DST changes don't shift them.

export interface MonthGrid {
  /** Local midnight of every cell, Monday first, whole weeks. */
  days: Date[];
  /** The query window [from, to) in epoch ms: the first cell's midnight to the midnight after the last. */
  from: number;
  to: number;
}

/** At least five rows, as the old agenda always showed; six when the month needs them. */
const MIN_WEEKS = 5;

/** The weeks that show `month` (0-11) of `year`, starting on Monday. Months may be out of range (-1, 12). */
export const monthGrid = (year: number, month: number): MonthGrid => {
  const first = new Date(year, month, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weeks = Math.max(MIN_WEEKS, Math.ceil((offset + daysInMonth) / 7));
  const days: Date[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(new Date(y, m, 1 - offset + i));
  return { days, from: days[0]!.getTime(), to: new Date(y, m, 1 - offset + weeks * 7).getTime() };
};

/** Local midnight of the day `ms` falls on. */
export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Tournaments whose start..end days include `day` (local midnight), as the old calendar did. */
export const onDay = <T extends { startDate: number; endDate?: number }>(tournaments: T[], day: Date): T[] => {
  const t = day.getTime();
  return tournaments.filter((x) => t >= startOfDay(x.startDate) && t <= startOfDay(x.endDate ?? x.startDate));
};

export const sameDay = (a: Date, b: Date): boolean =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

/** Short weekday names, Monday first, in the browser's locale. */
export const weekdayNames = (): string[] => {
  const format = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  // 2 March 2020 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2020, 2, 2 + i)));
};

const DAY = 86400000;

/** '' when there is nothing to warn about. `closesAt` is epoch ms. */
export const registrationWarning = (closesAt: number | undefined, startDate: number, now: number): string => {
  if (!closesAt) return "";
  // Closing at the start of the tournament is the default; not worth a warning.
  if (Math.abs(closesAt - startDate) < DAY) return "";
  if (closesAt < now) return "Registration Closed";
  const days = Math.ceil((closesAt - now) / DAY);
  const weeks = Math.round(days / 7);
  if (weeks > 2) return "";
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} left to register!`;
  return `${weeks} week${weeks > 1 ? "s" : ""} left to register!`;
};
