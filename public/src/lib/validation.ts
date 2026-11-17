import { fromLocalInput } from "./dates";
import { MAX_DESCRIPTION_LENGTH, type FormState } from "./formModel";

export const NOT_LOADED = "Load the tournament details from start.gg first: enter its link and press Fill.";
export const LINK_CHANGED = "The start.gg link changed after the details were loaded. Press Fill again.";

/** A positive integer id, as start.gg gives and the server requires. "0" means "not loaded yet". */
export const hasStartGGId = (id: string | number): boolean =>
  typeof id === "number" ? Number.isSafeInteger(id) && id > 0 : /^[1-9]\d*$/.test(id);

/**
 * The same rule as the server's normalizeStreamURL (src/db/normalizeTournament.ts): an http(s)
 * URL, or one without a scheme (https:// is added), on a real host name, with no user name or
 * password. Anything else would be dropped by the server, silently losing the stream.
 */
export const isValidStreamURL = (value: string): boolean => {
  const v = value.trim();
  if (v === "" || /\s/.test(v)) {
    return false;
  }
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/\//, "")}`;
  try {
    const parsed = new URL(candidate);
    return (
      /^https?:$/.test(parsed.protocol) &&
      parsed.username === "" &&
      parsed.password === "" &&
      /\.[a-z]{2,}$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
};

const DST_GAP = "does not exist in Dutch time (daylight saving time starts then)";

export interface ValidationContext {
  /** The slug currently in the start.gg link field. */
  linkSlug: string;
  /** Epoch ms; defaults to Date.now(). */
  now?: number;
}

const priceLineEmpty = (prices: FormState["prices"]) =>
  prices.length === 1 && prices[0].name === "" && prices[0].amount === "";

/**
 * Every check of the old form, in its order (the first failing one is shown), plus the checks
 * that keep the server from refusing or silently dropping parts of a post: the start.gg id,
 * an unchanged link, the DST gap, and the stream URL.
 * Returns the message to show, or undefined when the form can be posted.
 */
export const validateForm = (
  state: FormState,
  { linkSlug, now = Date.now() }: ValidationContext,
): string | undefined => {
  const start = fromLocalInput(state.startDate);
  const end = fromLocalInput(state.endDate);
  const checks: Array<[string, () => boolean]> = [
    ["Start.gg link is empty", () => linkSlug !== ""],
    [NOT_LOADED, () => hasStartGGId(state.id)],
    [LINK_CHANGED, () => linkSlug === state.url],
    ["Title is empty", () => state.title !== ""],
    ["Start Date is empty", () => state.startDate !== ""],
    ["End Date is empty", () => state.endDate !== ""],
    [`Start Date ${DST_GAP}`, () => start !== undefined],
    [`End Date ${DST_GAP}`, () => end !== undefined],
    ["Start Date is after End Date", () => start! < end!],
    ["Start Date is before current date", () => start! > now],
    ["Location is empty", () => state.isOnline || state.location !== ""],
    ["The start.gg page does not contain a City", () => state.isOnline || state.city !== ""],
    ["Tournament needs at least 1 event", () => state.events.length > 0],
    [
      "At least one events needs an entry cap",
      () => state.nocap || state.events.some((e) => e.cap !== "" && +e.cap > 0),
    ],
    [
      `Additional Notes cannot be longer than ${MAX_DESCRIPTION_LENGTH} characters`,
      () => state.description.length < MAX_DESCRIPTION_LENGTH,
    ],
    ["A price needs a value", () => priceLineEmpty(state.prices) || state.prices.every((p) => p.amount !== "")],
    ["A price needs a name", () => priceLineEmpty(state.prices) || state.prices.every((p) => p.name !== "")],
    ["Stream URL is not a valid link", () => state.streamURL === "" || isValidStreamURL(state.streamURL)],
    [
      `Stream start date ${DST_GAP}`,
      () => state.streamStartDate === "" || fromLocalInput(state.streamStartDate) !== undefined,
    ],
  ];
  return checks.find(([, ok]) => !ok())?.[0];
};
