/**
 * The form's dates are `<input type="datetime-local">` values ("YYYY-MM-DDTHH:mm") read as
 * Europe/Amsterdam wall-clock time, whatever the browser's own time zone is. The server
 * (src/db/normalizeTournament.ts) uses the same zone and the same parsing rules.
 */
export const TIME_ZONE = "Europe/Amsterdam";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type Parts = Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;

const wallClock = (ms: number): Parts => {
  const p: Record<string, number> = {};
  for (const x of parts.formatToParts(new Date(ms))) {
    if (x.type !== "literal") {
      p[x.type] = Number(x.value);
    }
  }
  return p as Parts;
};

/** The Amsterdam wall-clock time at `ms`, read as if it were UTC. */
const wallClockAsUTC = (ms: number): number => {
  const p = wallClock(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Epoch ms → the datetime-local value showing that moment in Amsterdam (seconds dropped). */
export const toLocalInput = (ms: number): string => {
  const p = wallClock(ms);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * A datetime-local value → epoch ms, read as Amsterdam time. Returns undefined for an empty or
 * malformed value, and for a wall time that doesn't exist (the hour skipped when DST starts).
 * A time that happens twice (the hour repeated when DST ends) resolves like the server does:
 * to the second occurrence (CET).
 */
export const fromLocalInput = (value: string): number | undefined => {
  const m = LOCAL_DATE_TIME.exec(value);
  if (!m) {
    return undefined;
  }
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(wall);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) {
    return undefined;
  }
  // Two passes settle the offset next to a DST switch.
  let ms = wall - (wallClockAsUTC(wall) - wall);
  ms = wall - (wallClockAsUTC(ms) - ms);
  return wallClockAsUTC(ms) === wall ? ms : undefined;
};

/** start.gg sends epoch seconds. */
export const fromStartGGTime = (seconds: number): string => toLocalInput(seconds * 1000);
