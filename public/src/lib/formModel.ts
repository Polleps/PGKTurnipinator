import { fromLocalInput, fromStartGGTime } from "./dates";

/** One "Events/Games" row. `cap` is the raw number-input text ("" = no cap); `key` is UI-only. */
export interface EventRow {
  key: string;
  name: string;
  cap: string;
}

/** Prices have no UI (it was commented out in the old form), but the body still carries the blank line. */
export interface PriceRow {
  key: string;
  name: string;
  amount: string;
}

/** The form model. Dates are datetime-local values in Europe/Amsterdam time (see dates.ts). */
export interface FormState {
  /** The start.gg slug the details were loaded from. */
  url: string;
  /** The start.gg id; "0" until a start.gg lookup succeeded. */
  id: string | number;
  title: string;
  nocap: boolean;
  isOnline: boolean;
  startDate: string;
  endDate: string;
  location: string;
  city: string;
  locationID?: string;
  events: EventRow[];
  description: string;
  prices: PriceRow[];
  image: string;
  streamURL: string;
  streamStartDate: string;
}

/** What `POST /actions/tournamentdetails/:slug` returns in `data` (src/web/services/smashgg.service.ts). */
export interface StartGGDetails {
  id: number | string;
  name: string;
  isOnline: boolean;
  mapsPlaceId?: string | null;
  address?: string | null;
  city?: string | null;
  startAt: number;
  endAt: number;
  events: string[];
  image: string;
  streams?: Array<{ streamName: string; streamSource: string }> | null;
}

/** The tournament JSON the form posts (as `action.args[0]`); the server normalizes it. */
export interface TournamentBody {
  url: string;
  id: string | number;
  title: string;
  nocap: boolean;
  isOnline: boolean;
  startDate: number | null;
  endDate: number | null;
  location: string;
  city: string;
  locationID?: string;
  events: Array<{ name: string; cap: string }>;
  description: string;
  prices: Array<{ name: string; amount: number }>;
  image: string;
  type: "smashgg";
  streamURL: string;
  /** Epoch ms when both stream fields are set; otherwise the raw input (the server then stores no stream). */
  streamStartDate: number | string;
}

let nextKey = 0;
export const newKey = (): string => `k${++nextKey}`;

export const emptyEvent = (): EventRow => ({ key: newKey(), name: "", cap: "" });
export const emptyPrice = (): PriceRow => ({ key: newKey(), name: "", amount: "" });

export const initialFormState = (): FormState => ({
  url: "",
  id: "0",
  title: "",
  nocap: false,
  isOnline: false,
  startDate: "",
  endDate: "",
  location: "",
  city: "",
  events: [emptyEvent()],
  description: "",
  prices: [emptyPrice()],
  image: "",
  streamURL: "",
  streamStartDate: "",
});

export const MAX_DESCRIPTION_LENGTH = 250;

/**
 * The start.gg link field: a full link (https://www.start.gg/tournament/<slug>/...) gives its
 * slug; anything that isn't a URL is taken as a slug as-is. A URL that isn't a tournament
 * link is an error.
 */
export const extractSlug = (link: string): { slug: string } | { error: string } => {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return { slug: link.trim() };
  }
  const path = parsed.pathname.split("/").slice(1);
  if (path.length < 2 || path[0] !== "tournament" || path[1] === "") {
    return { error: "Invalid Link" };
  }
  return { slug: path[1] };
};

const TWITCH_BASE_URL = "https://twitch.tv/";

/** "Super Smash Bros. Ultimate Singles" → "Ultimate Singles", as the old form did. */
export const shortenEventName = (name: string): string => name.replace("Super Smash Bros.", "").trim();

/**
 * Fills the form from a start.gg lookup. Keeps what the user typed that start.gg doesn't
 * know (notes, the no-cap flag); events are replaced, with empty caps.
 */
export const applyStartGG = (state: FormState, slug: string, data: StartGGDetails): FormState => {
  const startDate = fromStartGGTime(data.startAt);
  const stream = data.streams?.[0];
  return {
    ...state,
    url: slug,
    id: data.id,
    isOnline: data.isOnline,
    title: data.name,
    location: data.address ?? "",
    city: data.city ?? "",
    locationID: data.mapsPlaceId ?? undefined,
    startDate,
    endDate: fromStartGGTime(data.endAt),
    events: data.events.map((name) => ({ key: newKey(), name: shortenEventName(name), cap: "" })),
    image: data.image,
    // Only Twitch streams become a link; a stream defaults to starting with the tournament.
    streamURL: stream?.streamSource === "TWITCH" ? `${TWITCH_BASE_URL}${stream.streamName}` : "",
    streamStartDate: stream ? startDate : "",
  };
};

/** The stream field is lower-cased and trimmed as it's typed, as before; the server adds https:// if needed. */
export const cleanStreamInput = (value: string): string => value.toLowerCase().trim();

const toMillisOrNull = (value: string): number | null => fromLocalInput(value) ?? null;

/** The request body for a form state; the same shape the old lit-html form posted. */
export const toRequestBody = (state: FormState): TournamentBody => {
  const hasStream = state.streamURL !== "" && state.streamStartDate !== "";
  return {
    url: state.url,
    id: state.id,
    title: state.title,
    nocap: state.nocap,
    isOnline: state.isOnline,
    startDate: toMillisOrNull(state.startDate),
    endDate: toMillisOrNull(state.endDate),
    location: state.location,
    city: state.city,
    ...(state.locationID !== undefined && { locationID: state.locationID }),
    events: state.events.map((e) => ({ name: e.name, cap: e.cap })),
    description: state.description,
    prices: state.prices.map((p) => ({ name: p.name, amount: +p.amount })),
    image: state.image,
    type: "smashgg",
    streamURL: state.streamURL,
    streamStartDate: hasStream ? (toMillisOrNull(state.streamStartDate) ?? state.streamStartDate) : state.streamStartDate,
  };
};

/** The `/actions/run` action that posts a tournament. */
export const postTournamentAction = (state: FormState) => ({
  name: "posttournament",
  args: [JSON.stringify(toRequestBody(state))],
});
