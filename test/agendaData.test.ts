import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  ApiError,
  fetchAllTournaments,
  fetchTournamentPage,
  liveStreamUrl,
  tournamentCap,
  TournamentPager,
  tournamentsUrl,
  WindowCache,
  type FetchLike,
  type Tournament,
} from "../agenda/src/api";
import { monthGrid, onDay, registrationWarning } from "../agenda/src/dates";

const HOUR = 3600000;
const DAY = 24 * HOUR;

const tournament = (id: string, overrides: Partial<Tournament> = {}): Tournament => ({
  id,
  url: `slug-${id}`,
  title: `T ${id}`,
  image: "",
  description: "",
  location: "",
  city: "",
  locationID: "",
  startDate: 0,
  endDate: 0,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [],
  prices: [],
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fake API: pages of `items` chunked by `limit`, cursor = index of the next item. Records URLs. */
const fakeApi = (items: Tournament[]) => {
  const urls: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    urls.push(url);
    const q = new URL(url, "http://agenda.test").searchParams;
    const limit = Math.min(Number(q.get("limit") ?? 20), 100);
    const start = Number(q.get("cursor") ?? 0);
    const end = start + limit;
    return Promise.resolve(
      json({ items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null }),
    );
  };
  return { urls, fetchImpl };
};

/** The rejection reason; fails if the promise resolves. */
const rejection = (p: Promise<unknown>): Promise<Error> =>
  p.then(
    () => {
      throw new Error("expected a rejection");
    },
    (e: unknown) => e as Error,
  );

const many = (n: number) => Array.from({ length: n }, (_, i) => tournament(String(i + 1)));

describe("tournamentsUrl", () => {
  test("the default query is the bare path, so page 1 has one stable URL", () => {
    expect(tournamentsUrl()).toBe("/api/tournaments");
    expect(tournamentsUrl({ cursor: undefined })).toBe("/api/tournaments");
  });

  test("parameters come in a fixed order and are encoded", () => {
    expect(tournamentsUrl({ cursor: "a+b/c=", limit: 100, to: 2, from: 1 })).toBe(
      "/api/tournaments?from=1&to=2&limit=100&cursor=a%2Bb%2Fc%3D",
    );
  });
});

describe("fetchAllTournaments", () => {
  test("follows nextCursor until null", async () => {
    const api = fakeApi(many(250));
    const items = await fetchAllTournaments({ from: 10, to: 20, limit: 100 }, api.fetchImpl);
    expect(items.map((t) => t.id)).toEqual(many(250).map((t) => t.id));
    expect(api.urls).toEqual([
      "/api/tournaments?from=10&to=20&limit=100",
      "/api/tournaments?from=10&to=20&limit=100&cursor=100",
      "/api/tournaments?from=10&to=20&limit=100&cursor=200",
    ]);
  });

  test("one request when everything fits; an empty window is fine", async () => {
    const api = fakeApi(many(21));
    expect(await fetchAllTournaments({ limit: 100 }, api.fetchImpl)).toHaveLength(21);
    expect(api.urls).toHaveLength(1);
    expect(await fetchAllTournaments({ limit: 100 }, fakeApi([]).fetchImpl)).toEqual([]);
  });

  test("a repeated cursor or too many pages is an error, not an endless loop", async () => {
    const loop: FetchLike = () => Promise.resolve(json({ items: [tournament("1")], nextCursor: "same" }));
    expect((await rejection(fetchAllTournaments({}, loop))).message).toContain("same cursor twice");
    let n = 0;
    const endless: FetchLike = () => Promise.resolve(json({ items: [], nextCursor: String(n++) }));
    expect((await rejection(fetchAllTournaments({}, endless, 5))).message).toContain("Gave up after 5 pages");
  });

  test("an error on a later page rejects the whole window", async () => {
    let calls = 0;
    const flaky: FetchLike = () =>
      Promise.resolve(calls++ === 0 ? json({ items: many(100), nextCursor: "x" }) : json({ error: "boom" }, 500));
    const error = await fetchAllTournaments({ limit: 100 }, flaky).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });
});

describe("fetchTournamentPage errors", () => {
  test("network failure (offline, SW without a cached copy) is status 0", async () => {
    const error = await fetchTournamentPage({}, () => Promise.reject(new TypeError("Failed to fetch"))).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).offline).toBe(true);
  });

  test("a 400 carries the server's message", async () => {
    const error = await fetchTournamentPage({ cursor: "bad" }, () =>
      Promise.resolve(json({ error: '"cursor" is not valid' }, 400)),
    ).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toContain('"cursor" is not valid');
    expect((error as ApiError).offline).toBe(false);
  });

  test("non-JSON and wrongly shaped bodies are rejected", async () => {
    const html: FetchLike = () => Promise.resolve(new Response("<html>", { status: 200 }));
    expect((await rejection(fetchTournamentPage({}, html))).message).toContain("Unexpected response");
    // The legacy /tournaments array shape is not a page.
    expect(
      (await rejection(fetchTournamentPage({}, () => Promise.resolve(json([tournament("1")]))))).message,
    ).toContain("Unexpected response");
    const html502: FetchLike = () => Promise.resolve(new Response("Bad gateway", { status: 502 }));
    expect((await rejection(fetchTournamentPage({}, html502))).message).toContain("Request failed (502)");
  });
});

describe("TournamentPager", () => {
  test("loads one page per call, stops at the last page", async () => {
    const api = fakeApi(many(45));
    const pager = new TournamentPager(api.fetchImpl);
    await pager.loadMore();
    expect(pager.state.items).toHaveLength(20);
    expect(pager.state.done).toBe(false);
    await pager.loadMore();
    await pager.loadMore();
    expect(pager.state.items.map((t) => t.id)).toEqual(many(45).map((t) => t.id));
    expect(pager.state.done).toBe(true);
    await pager.loadMore();
    expect(api.urls).toEqual(["/api/tournaments", "/api/tournaments?cursor=20", "/api/tournaments?cursor=40"]);
  });

  test("ignores calls while loading (an observer and a click at once)", async () => {
    const api = fakeApi(many(45));
    const pager = new TournamentPager(api.fetchImpl);
    await Promise.all([pager.loadMore(), pager.loadMore(), pager.loadMore()]);
    expect(api.urls).toHaveLength(1);
    expect(pager.state.items).toHaveLength(20);
  });

  test("an error keeps the items, and the next call retries the same cursor", async () => {
    const api = fakeApi(many(30));
    let offline = false;
    const states: boolean[] = [];
    const pager = new TournamentPager(
      (url) => (offline ? Promise.reject(new TypeError("offline")) : api.fetchImpl(url)),
      (s) => states.push(s.loading),
    );
    await pager.loadMore();
    offline = true;
    await pager.loadMore();
    expect(pager.state.error?.offline).toBe(true);
    expect(pager.state.items).toHaveLength(20);
    expect(pager.state.done).toBe(false);
    offline = false;
    await pager.loadMore();
    expect(pager.state.error).toBeNull();
    expect(pager.state.items).toHaveLength(30);
    expect(api.urls).toEqual(["/api/tournaments", "/api/tournaments?cursor=20"]);
    expect(states).toEqual([true, false, true, false, true, false]);
  });

  test("drops duplicates by id", async () => {
    const pages = [
      { items: [tournament("1"), tournament("2")], nextCursor: "a" },
      { items: [tournament("2"), tournament("3")], nextCursor: null },
    ];
    let i = 0;
    const pager = new TournamentPager(() => Promise.resolve(json(pages[i++])));
    await pager.loadMore();
    await pager.loadMore();
    expect(pager.state.items.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });
});

describe("WindowCache", () => {
  test("memoizes a window, refetches after the TTL, forgets failures", async () => {
    let clock = 0;
    let fail = true;
    const api = fakeApi(many(3));
    const cache = new WindowCache(
      (url) => (fail ? Promise.reject(new TypeError("offline")) : api.fetchImpl(url)),
      1000,
      () => clock,
    );
    expect(await rejection(cache.get(1, 2))).toBeInstanceOf(ApiError);
    fail = false;
    expect(await cache.get(1, 2)).toHaveLength(3);
    expect(await cache.get(1, 2)).toHaveLength(3);
    expect(api.urls).toEqual(["/api/tournaments?from=1&to=2&limit=100"]);
    clock = 1000;
    await cache.get(1, 2);
    expect(api.urls).toHaveLength(2);
  });
});

describe("monthGrid", () => {
  const originalTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Amsterdam";
  });
  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  test("runs in Europe/Amsterdam", () => {
    expect(new Date(2025, 0, 1).getTimezoneOffset()).toBe(-60);
    expect(new Date(2025, 6, 1).getTimezoneOffset()).toBe(-120);
  });

  test("March 2025: Monday 24 Feb to Sunday 6 April, across the DST start", () => {
    const g = monthGrid(2025, 2);
    expect(g.days).toHaveLength(42); // starts on a Saturday, 31 days
    expect(iso(g.days[0]!)).toBe("2025-02-24");
    expect(iso(g.days.at(-1)!)).toBe("2025-04-06");
    expect(g.from).toBe(Date.parse("2025-02-23T23:00:00Z"));
    expect(g.to).toBe(Date.parse("2025-04-06T22:00:00Z")); // midnight CEST after the last cell
    // Every cell is a local midnight and a Monday-first week, despite the 23-hour day.
    for (const [i, d] of g.days.entries()) {
      expect(d.getHours()).toBe(0);
      expect((d.getDay() + 6) % 7).toBe(i % 7);
    }
    expect(new Set(g.days.map(iso)).size).toBe(42);
  });

  test("October 2025 across the DST end", () => {
    const g = monthGrid(2025, 9);
    expect(iso(g.days[0]!)).toBe("2025-09-29");
    expect(g.days.map(iso)).toContain("2025-10-26");
    expect(g.days.map(iso)).toContain("2025-10-27");
    expect(g.days.every((d) => d.getHours() === 0)).toBe(true);
    expect(g.to - g.from).toBe(35 * DAY + HOUR); // 35 days, one of them 25 hours
  });

  test("a month starting on Sunday keeps its 1st (the old grid skipped it)", () => {
    const g = monthGrid(2026, 2); // 1 March 2026 is a Sunday
    expect(iso(g.days[0]!)).toBe("2026-02-23");
    expect(g.days.map(iso)).toContain("2026-03-01");
    expect(g.days.map(iso)).toContain("2026-03-31");
    expect(g.days).toHaveLength(42);
  });

  test("a month starting on Monday starts on its 1st; at least five weeks", () => {
    const sep = monthGrid(2025, 8); // 1 September 2025 is a Monday
    expect(iso(sep.days[0]!)).toBe("2025-09-01");
    expect(sep.days).toHaveLength(35);
    const feb = monthGrid(2027, 1); // Monday 1 February 2027, 28 days: four weeks, padded to five
    expect(iso(feb.days[0]!)).toBe("2027-02-01");
    expect(iso(feb.days.at(-1)!)).toBe("2027-03-07");
  });

  test("month and year edges: December, January and out-of-range months", () => {
    const dec = monthGrid(2025, 11);
    expect(iso(dec.days[0]!)).toBe("2025-12-01");
    expect(iso(dec.days.at(-1)!)).toBe("2026-01-04");
    const jan = monthGrid(2026, 0);
    expect(iso(jan.days[0]!)).toBe("2025-12-29");
    expect(monthGrid(2025, 12)).toEqual(jan);
    expect(monthGrid(2026, -1)).toEqual(dec);
    // Adjacent windows of consecutive months overlap only in shared weeks, never leave gaps.
    expect(dec.to).toBeGreaterThanOrEqual(jan.from);
  });

  test("onDay matches local days from start to end", () => {
    const g = monthGrid(2025, 2);
    const weekend = tournament("1", {
      startDate: Date.parse("2025-03-29T10:00:00+01:00"),
      endDate: Date.parse("2025-03-30T20:00:00+02:00"),
    });
    const late = tournament("2", {
      startDate: Date.parse("2025-03-31T23:30:00+02:00"),
      endDate: Date.parse("2025-04-01T01:00:00+02:00"),
    });
    const hits = g.days.filter((d) => onDay([weekend, late], d).length > 0).map(iso);
    expect(hits).toEqual(["2025-03-29", "2025-03-30", "2025-03-31", "2025-04-01"]);
  });
});

describe("tournament helpers", () => {
  test("tournamentCap: the highest numeric event cap, else '?'", () => {
    expect(tournamentCap({ events: [{ name: "a", cap: "32" }, { name: "b", cap: "64" }, { name: "c" }] })).toBe(64);
    expect(tournamentCap({ events: [{ name: "a", cap: "" }] })).toBe("?");
    expect(tournamentCap({ events: [] })).toBe("?");
  });

  test("registrationWarning takes epoch ms (no more * 1000)", () => {
    const now = Date.parse("2026-06-01T12:00:00Z");
    const start = now + 30 * DAY;
    expect(registrationWarning(undefined, start, now)).toBe("");
    expect(registrationWarning(start - HOUR, start, now)).toBe("");
    expect(registrationWarning(now - DAY, start, now)).toBe("Registration Closed");
    expect(registrationWarning(now + 3 * DAY, start, now)).toBe("3 days left to register!");
    expect(registrationWarning(now + DAY, start, now)).toBe("1 day left to register!");
    expect(registrationWarning(now + 10 * DAY, start, now)).toBe("1 week left to register!");
    expect(registrationWarning(now + 14 * DAY, start, now)).toBe("2 weeks left to register!");
    expect(registrationWarning(now + 21 * DAY, start, now)).toBe("");
  });

  test("liveStreamUrl: only while ongoing, only http(s)", () => {
    const now = 1000;
    const live = tournament("1", { startDate: 500, endDate: 2000, streamURL: "https://twitch.tv/x" });
    expect(liveStreamUrl(live, now)).toBe("https://twitch.tv/x");
    expect(liveStreamUrl({ ...live, startDate: 1500 }, now)).toBeUndefined();
    expect(liveStreamUrl({ ...live, endDate: 900 }, now)).toBeUndefined();
    expect(liveStreamUrl({ ...live, streamURL: undefined }, now)).toBeUndefined();
    expect(liveStreamUrl({ ...live, streamURL: "javascript:alert(1)" }, now)).toBeUndefined();
    expect(liveStreamUrl({ ...live, streamURL: "not a url" }, now)).toBeUndefined();
  });
});
