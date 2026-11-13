// Data layer for the agenda: `GET /api/tournaments` (see src/web/routers/TournamentApi.router.ts).
// Framework-free so it can be unit-tested with a fake fetch.

export interface TournamentEvent {
  name: string;
  cap?: string | number;
}

/** A tournament as the API sends it: public fields only, dates in epoch ms, NULL columns omitted. */
export interface Tournament {
  id: string;
  url: string;
  title: string;
  image: string;
  description: string;
  location: string;
  city: string;
  locationID: string;
  startDate: number;
  endDate: number;
  type: string;
  isOnline: boolean;
  nocap: boolean;
  pr: boolean;
  events: TournamentEvent[];
  prices: unknown[];
  streamURL?: string;
  streamStartDate?: number;
  participants?: number;
  /** Epoch ms. */
  registrationClosesAt?: number;
}

export interface TournamentPage {
  items: Tournament[];
  nextCursor: string | null;
}

export interface TournamentQuery {
  from?: number;
  to?: number;
  limit?: number;
  cursor?: string;
}

export type FetchLike = (input: string) => Promise<Response>;

export const API_PATH = "/api/tournaments";
/** The API's maximum page size; used for calendar windows. */
export const MAX_LIMIT = 100;
/** Stop following cursors after this many pages (a window of 100 * 50 tournaments is not a month). */
export const MAX_PAGES = 50;

/** A failed request. `status` is 0 when there was no HTTP response (offline, network error). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

/**
 * The request URL. Parameters are added in a fixed order and only when set, so the same query
 * always has the same URL: the service worker caches by full URL. The upcoming list's first page
 * is plain `/api/tournaments` (the server's default `from`), never `from=Date.now()`.
 */
export const tournamentsUrl = (query: TournamentQuery = {}): string => {
  const params = new URLSearchParams();
  if (query.from !== undefined) params.set("from", String(query.from));
  if (query.to !== undefined) params.set("to", String(query.to));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor !== undefined) params.set("cursor", query.cursor);
  const qs = params.toString();
  return qs ? `${API_PATH}?${qs}` : API_PATH;
};

const isPage = (body: unknown): body is TournamentPage => {
  if (typeof body !== "object" || body === null) return false;
  const { items, nextCursor } = body as Record<string, unknown>;
  return Array.isArray(items) && (nextCursor === null || typeof nextCursor === "string");
};

/** One page. Throws ApiError on network errors, HTTP errors and unexpected bodies. */
export const fetchTournamentPage = async (
  query: TournamentQuery = {},
  fetchImpl: FetchLike = (url) => fetch(url),
): Promise<TournamentPage> => {
  let res: Response;
  try {
    res = await fetchImpl(tournamentsUrl(query));
  } catch {
    throw new ApiError("Could not reach the server.", 0);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const detail =
      typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : res.statusText;
    throw new ApiError(`Request failed (${res.status})${detail ? `: ${detail}` : ""}`, res.status);
  }
  if (!isPage(body)) {
    throw new ApiError("Unexpected response from the server.", res.status);
  }
  return body;
};

/** Every tournament matching the query, following `nextCursor` until it is null. */
export const fetchAllTournaments = async (
  query: Omit<TournamentQuery, "cursor">,
  fetchImpl?: FetchLike,
  maxPages = MAX_PAGES,
): Promise<Tournament[]> => {
  const items: Tournament[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchTournamentPage({ ...query, cursor }, fetchImpl);
    items.push(...result.items);
    if (result.nextCursor === null) return items;
    if (seen.has(result.nextCursor)) {
      throw new ApiError("The server returned the same cursor twice.", 200);
    }
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new ApiError(`Gave up after ${maxPages} pages.`, 200);
};

export interface PagerState {
  items: Tournament[];
  /** No more pages. */
  done: boolean;
  loading: boolean;
  error: ApiError | null;
}

/**
 * The upcoming list: the default query, one page at a time. `loadMore()` ignores calls while a
 * page is loading or after the last one; after an error the next call retries the same cursor.
 */
export class TournamentPager {
  private cursor: string | undefined;
  private _state: PagerState = { items: [], done: false, loading: false, error: null };

  constructor(
    private readonly fetchImpl?: FetchLike,
    private readonly onChange: (state: PagerState) => void = () => undefined,
  ) {}

  get state(): PagerState {
    return this._state;
  }

  private set(patch: Partial<PagerState>) {
    this._state = { ...this._state, ...patch };
    this.onChange(this._state);
  }

  async loadMore(): Promise<void> {
    if (this._state.loading || this._state.done) return;
    this.set({ loading: true, error: null });
    try {
      const page = await fetchTournamentPage({ cursor: this.cursor }, this.fetchImpl);
      // Keyset pages don't overlap, but a page served from the SW cache might.
      const ids = new Set(this._state.items.map((t) => t.id));
      const fresh = page.items.filter((t) => !ids.has(t.id));
      this.cursor = page.nextCursor ?? undefined;
      this.set({ items: [...this._state.items, ...fresh], done: page.nextCursor === null, loading: false });
    } catch (e) {
      this.set({ loading: false, error: e instanceof ApiError ? e : new ApiError(String(e), 0) });
    }
  }
}

/** Tournaments per calendar window, memoized for `ttlMs`; failed loads are not kept. */
export class WindowCache {
  private entries = new Map<string, { at: number; value: Promise<Tournament[]> }>();

  constructor(
    private readonly fetchImpl?: FetchLike,
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(from: number, to: number): Promise<Tournament[]> {
    const key = `${from}-${to}`;
    const hit = this.entries.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const value = fetchAllTournaments({ from, to, limit: MAX_LIMIT }, this.fetchImpl);
    this.entries.set(key, { at: this.now(), value });
    value.catch(() => {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    return value;
  }
}

/** Highest numeric event cap, or '?' (the old agenda's `transformTournament`). */
export const tournamentCap = (t: Pick<Tournament, "events">): number | "?" => {
  const caps = (t.events ?? [])
    .map((e) => e.cap)
    .filter((c) => +c! === +c!)
    .map(Number)
    .sort((a, b) => b - a);
  return caps[0] || "?";
};

/** Ongoing right now and has a stream with an http(s) link. */
export const liveStreamUrl = (t: Tournament, now: number): string | undefined => {
  if (!t.streamURL || t.startDate > now || now > t.endDate) return undefined;
  try {
    const url = new URL(t.streamURL);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};
