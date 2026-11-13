import type { NewTournament, TournamentEvent, TournamentPrice } from "./schema";

/**
 * Turns a tournament as it arrives (a Firestore export doc at import, or the form's JSON
 * when a tournament is posted) into a row for the `tournaments` table.
 *
 * Both paths use this one function, because the current form sends values the NOT NULL
 * columns reject too (e.g. null location fields for online tournaments, numeric ids).
 * Values that can't be repaired make the doc invalid ("quarantined" at import, rejected
 * when posted); everything else gets a default, listed in `defaulted`.
 *
 * `participants` and `registrationClosesAt` are never taken from the input: only the
 * start.gg status refresh writes them.
 */
export type NormalizeResult =
  | { ok: true; row: NormalizedTournament; defaulted: DefaultedField[]; droppedKeys: string[] }
  | { ok: false; reason: string; /** The start.gg id is missing or not a valid id. */ badId?: boolean };

export type NormalizedTournament = Required<Omit<NewTournament, "participants" | "registrationClosesAt">>;

export type DefaultedField =
  | "id"
  | "endDate"
  | "image"
  | "description"
  | "location"
  | "city"
  | "locationID"
  | "type"
  | "isOnline"
  | "nocap"
  | "pr"
  | "events"
  | "prices"
  | "streamURL"
  | "streamStartDate"
  | "messageID"
  | "guildEventID";

/** Keys the normalizer reads. Anything else (e.g. the form's `error`, `smashggID`, `lat`/`lng`) is dropped. */
const KNOWN_KEYS = new Set([
  "id",
  "url",
  "title",
  "startDate",
  "endDate",
  "image",
  "description",
  "location",
  "city",
  "locationID",
  "type",
  "isOnline",
  "nocap",
  "pr",
  "events",
  "prices",
  "streamURL",
  "streamStartDate",
  "messageID",
  "guildEventID",
  // Owned by the start.gg refresh; read from the DB, never from input.
  "participants",
  "registrationClosesAt",
]);

export const STREAM_TIME_ZONE = "Europe/Amsterdam";

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

const nonBlank = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

/** Epoch ms from a number, a Date, or a Firestore Timestamp (or its export stand-in). */
const toMillis = (x: unknown): number | undefined => {
  if (typeof x === "number") {
    return Number.isFinite(x) ? Math.round(x) : undefined;
  }
  if (x instanceof Date) {
    return toMillis(x.getTime());
  }
  if (isObject(x) && typeof x.toMillis === "function") {
    return toMillis((x.toMillis as () => unknown)());
  }
  return undefined;
};

/**
 * start.gg tournament ids are positive integers (a JSON number from start.gg, or its string).
 * The form starts with id "0" until a start.gg lookup succeeds, so "0" (and anything else that
 * isn't a positive integer) is invalid: storing it would merge unrelated posts into one row.
 */
const parseId = (x: unknown): { id: string } | "missing" | "invalid" => {
  if (x === undefined || x === null || (typeof x === "string" && x.trim() === "")) {
    return "missing";
  }
  if (typeof x === "number") {
    return Number.isSafeInteger(x) && x > 0 ? { id: String(x) } : "invalid";
  }
  if (typeof x === "string" && /^[1-9]\d*$/.test(x.trim()) && Number.isSafeInteger(Number(x.trim()))) {
    return { id: x.trim() };
  }
  return "invalid";
};

const optionalId = (x: unknown): string | null => {
  if (typeof x === "number" && Number.isSafeInteger(x)) {
    return String(x);
  }
  return nonBlank(x) ? x : null;
};

const amsterdamParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: STREAM_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The wall-clock time in Europe/Amsterdam at `ms`, read as if it were UTC. */
const amsterdamWallClockAsUTC = (ms: number): number => {
  const p = Object.fromEntries(amsterdamParts.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses the form's datetime-local value ("YYYY-MM-DDTHH:mm") as Europe/Amsterdam wall time.
 * Returns undefined for anything else, or for a wall time that doesn't exist (DST gap).
 */
export const parseAmsterdamLocalDateTime = (value: string): number | undefined => {
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
  let ms = wall - (amsterdamWallClockAsUTC(wall) - wall);
  ms = wall - (amsterdamWallClockAsUTC(ms) - ms);
  return amsterdamWallClockAsUTC(ms) === wall ? ms : undefined;
};

/**
 * An http(s) URL, or a scheme-less (`twitch.tv/name`) or protocol-relative (`//twitch.tv/name`)
 * one with https:// added. Returns undefined for anything that isn't a public web URL: a bare
 * word, a sentence, another scheme, or a URL with a user name or password in it.
 */
export const normalizeStreamURL = (value: string): { url: string; prefixed: boolean } | undefined => {
  const v = value.trim();
  if (v === "" || /\s/.test(v)) {
    return undefined;
  }
  const hasScheme = /^https?:\/\//i.test(v);
  const candidate = hasScheme ? v : `https://${v.replace(/^\/\//, "")}`;
  try {
    const parsed = new URL(candidate);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      !/\.[a-z]{2,}$/i.test(parsed.hostname)
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return { url: candidate, prefixed: !hasScheme };
};

const normalizeEvents = (x: unknown): { events: TournamentEvent[]; changed: boolean } => {
  if (!Array.isArray(x)) {
    return { events: [], changed: true };
  }
  let changed = false;
  const events: TournamentEvent[] = [];
  for (const e of x) {
    if (!isObject(e) || !nonBlank(e.name)) {
      changed = true;
      continue;
    }
    let cap: string;
    if (typeof e.cap === "string") {
      cap = e.cap;
    } else if (typeof e.cap === "number" && Number.isFinite(e.cap)) {
      cap = String(e.cap);
      changed = true;
    } else {
      cap = "";
      changed = true;
    }
    if (Object.keys(e).some((k) => k !== "name" && k !== "cap")) {
      changed = true;
    }
    events.push({ name: e.name, cap });
  }
  return { events, changed };
};

const normalizePrices = (x: unknown): { prices: TournamentPrice[]; changed: boolean } => {
  if (!Array.isArray(x)) {
    return { prices: [], changed: true };
  }
  let changed = false;
  const prices: TournamentPrice[] = [];
  for (const p of x) {
    if (!isObject(p)) {
      changed = true;
      continue;
    }
    const name = typeof p.name === "string" ? p.name : "";
    const amount = typeof p.amount === "number" ? p.amount : Number(p.amount);
    const validAmount = Number.isFinite(amount) ? amount : 0;
    if (name !== p.name || validAmount !== p.amount || Object.keys(p).some((k) => k !== "name" && k !== "amount")) {
      changed = true;
    }
    // The form always sends one blank line; a named line with amount 0 is kept.
    if (name.trim() === "" && validAmount === 0) {
      changed = true;
      continue;
    }
    prices.push({ name, amount: validAmount });
  }
  return { prices, changed };
};

export const normalizeTournament = (doc: unknown): NormalizeResult => {
  if (!isObject(doc)) {
    return { ok: false, reason: "not an object" };
  }

  const parsedId = parseId(doc.id);
  const id = typeof parsedId === "object" ? parsedId.id : undefined;
  const url = nonBlank(doc.url) ? doc.url.trim() : undefined;
  const title = nonBlank(doc.title) ? doc.title : undefined;
  const startDate = toMillis(doc.startDate);

  const missing = [
    parsedId === "missing" && "id",
    url === undefined && "url",
    title === undefined && "title",
    startDate === undefined && "startDate",
  ].filter(Boolean);
  if (id === undefined || url === undefined || title === undefined || startDate === undefined) {
    const problems = [
      ...(parsedId === "invalid" ? [`invalid id ${JSON.stringify(doc.id)}`] : []),
      ...(missing.length > 0 ? [`missing ${missing.join(", ")}`] : []),
    ];
    return { ok: false, reason: problems.join("; "), ...(id === undefined ? { badId: true } : {}) };
  }

  const defaulted: DefaultedField[] = [];
  const fallback = <T>(field: DefaultedField, value: T): T => {
    defaulted.push(field);
    return value;
  };
  const str = (field: DefaultedField): string => {
    const v = doc[field];
    return typeof v === "string" ? v : fallback(field, "");
  };
  const flag = (field: DefaultedField): boolean => {
    const v = doc[field];
    return typeof v === "boolean" ? v : fallback(field, false);
  };

  if (typeof doc.id !== "string") {
    defaulted.push("id");
  }

  const rawEnd = toMillis(doc.endDate);
  const endDate = rawEnd !== undefined && rawEnd >= startDate ? rawEnd : fallback("endDate", startDate);

  const type = doc.type === "smashgg" || doc.type === "other" ? doc.type : fallback("type", "smashgg" as const);

  const { events, changed: eventsChanged } = normalizeEvents(doc.events);
  if (eventsChanged) {
    defaulted.push("events");
  }
  const { prices, changed: pricesChanged } = normalizePrices(doc.prices);
  if (pricesChanged) {
    defaulted.push("prices");
  }

  // Stream: both set, or both NULL.
  let streamURL: string | null = null;
  if (typeof doc.streamURL === "string") {
    const parsed = normalizeStreamURL(doc.streamURL);
    streamURL = parsed?.url ?? null;
    if (!parsed || parsed.prefixed || parsed.url !== doc.streamURL) {
      defaulted.push("streamURL");
    }
  } else {
    defaulted.push("streamURL");
  }
  let streamStartDate: number | null = null;
  if (typeof doc.streamStartDate === "string") {
    streamStartDate = parseAmsterdamLocalDateTime(doc.streamStartDate) ?? null;
    defaulted.push("streamStartDate");
  } else {
    streamStartDate = toMillis(doc.streamStartDate) ?? null;
    if (streamStartDate === null || typeof doc.streamStartDate !== "number") {
      defaulted.push("streamStartDate");
    }
  }
  if (streamURL === null || streamStartDate === null) {
    if (streamURL !== null && !defaulted.includes("streamURL")) {
      defaulted.push("streamURL");
    }
    if (streamStartDate !== null && !defaulted.includes("streamStartDate")) {
      defaulted.push("streamStartDate");
    }
    streamURL = null;
    streamStartDate = null;
  }

  const messageID = optionalId(doc.messageID);
  if (messageID === null || typeof doc.messageID !== "string") {
    defaulted.push("messageID");
  }
  const guildEventID = optionalId(doc.guildEventID);
  if (guildEventID === null || typeof doc.guildEventID !== "string") {
    defaulted.push("guildEventID");
  }

  const row: NormalizedTournament = {
    id,
    url,
    title,
    image: str("image"),
    description: str("description"),
    location: str("location"),
    city: str("city"),
    locationID: str("locationID"),
    startDate,
    endDate,
    type,
    isOnline: flag("isOnline"),
    nocap: flag("nocap"),
    pr: doc.pr === true ? true : doc.pr === false ? false : fallback("pr", false),
    events,
    prices,
    streamURL,
    streamStartDate,
    messageID,
    guildEventID,
  };

  const droppedKeys = Object.keys(doc).filter((k) => !KNOWN_KEYS.has(k));
  return { ok: true, row, defaulted, droppedKeys };
};
