import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import { request, type Server } from "http";
import type { AddressInfo } from "net";
import { openDatabase } from "../src/db/database";
import type { NormalizedTournament } from "../src/db/normalizeTournament";
import { TournamentRepository } from "../src/db/TournamentRepository";
import { decodeCursor, encodeCursor, TournamentApiRouter } from "../src/web/routers/TournamentApi.router";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-06-15T12:00:00Z");

const tournament = (id: string, overrides: Partial<NormalizedTournament> = {}): NormalizedTournament => ({
  id,
  url: `fixture-${id}`,
  title: `Fixture ${id}`,
  image: "",
  description: "",
  location: "Teststraat 1, Testdorp",
  city: "Testdorp",
  locationID: "",
  startDate: NOW + DAY,
  endDate: NOW + DAY + 8 * HOUR,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "" }],
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: "300000000000000001",
  guildEventID: null,
  ...overrides,
});

const at = (iso: string, hours = 8) => ({ startDate: Date.parse(iso), endDate: Date.parse(iso) + hours * HOUR });

let repo: TournamentRepository;
let server: Server;
let base: string;

const seed = () => {
  repo = new TournamentRepository(openDatabase({ path: ":memory:" }));
  // Past: May 2026.
  repo.upsert(tournament("101", at("2026-05-02T10:00:00Z")));
  repo.upsert(tournament("102", { ...at("2026-05-16T10:00:00Z"), isOnline: true, location: "", city: "" }));
  repo.upsert(tournament("103", at("2026-05-31T22:00:00Z", 4))); // ends in June
  repo.upsert(tournament("104", at("2026-04-30T20:00:00Z", 6))); // ends on May 1st
  // Ongoing three-day tournament: started two days ago.
  repo.upsert(tournament("200", { startDate: NOW - 2 * DAY, endDate: NOW + DAY, url: "fixture-weekender" }));
  // Upcoming, with a tie on start_date (ordered by id).
  repo.upsert(tournament("302", at("2026-06-20T10:00:00Z")));
  repo.upsert(tournament("301", { ...at("2026-06-20T10:00:00Z"), isOnline: true, location: "" }));
  repo.upsert(
    tournament("303", {
      ...at("2026-06-27T10:00:00Z"),
      streamURL: "https://twitch.tv/fixture",
      streamStartDate: Date.parse("2026-06-27T09:30:00Z"),
      guildEventID: "400000000000000001",
    }),
  );
  // A reused slug: three editions, one in the past.
  repo.upsert(tournament("401", { ...at("2025-06-07T10:00:00Z"), url: "fixture-reused" }));
  repo.upsert(tournament("402", { ...at("2026-07-04T10:00:00Z"), url: "fixture-reused" }));
  repo.upsert(tournament("400", { ...at("2026-01-10T10:00:00Z"), url: "fixture-reused" }));
};

beforeAll(async () => {
  seed();
  const app = express();
  app.use("/api/tournaments", new TournamentApiRouter(() => repo, () => NOW).router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

/** Plain http (the test preload disables fetch). */
const get = (query = "") =>
  new Promise<{ status: number; headers: Record<string, unknown>; body: any }>((resolve, reject) => {
    request(`${base}/api/tournaments${query}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: JSON.parse(body) }));
    })
      .on("error", reject)
      .end();
  });

const ids = (r: { body: { items: Array<{ id: string }> } }) => r.body.items.map((t) => t.id);

/** Follows nextCursor to the end; returns every id in order. `query` starts with "?". */
const walk = async (query: string) => {
  const seen: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const r = await get(cursor ? `${query}&cursor=${cursor}` : query);
    expect(r.status).toBe(200);
    seen.push(...ids(r));
    cursor = r.body.nextCursor;
    pages++;
  } while (cursor && pages < 1000);
  return { seen, pages };
};

describe("GET /api/tournaments: default (upcoming)", () => {
  test("upcoming and ongoing, by start date then id, with Cache-Control", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=60");
    // The ongoing weekender counts as upcoming; ties on start_date go by id.
    expect(ids(r)).toEqual(["200", "301", "302", "303", "402"]);
    expect(r.body.nextCursor).toBeNull();
  });

  test("items carry public fields only, dates in ms, NULLs omitted, streamURL when set", async () => {
    const items = (await get()).body.items as Array<Record<string, unknown>>;
    for (const item of items) {
      expect(item).not.toHaveProperty("messageID");
      expect(item).not.toHaveProperty("guildEventID");
      expect(Object.values(item)).not.toContain(null);
      expect(typeof item.id).toBe("string");
      expect(typeof item.startDate).toBe("number");
    }
    const streamed = items.find((t) => t.id === "303")!;
    expect(streamed).toMatchObject({ streamURL: "https://twitch.tv/fixture", streamStartDate: Date.parse("2026-06-27T09:30:00Z") });
    expect(items.find((t) => t.id === "302")).not.toHaveProperty("streamURL");
  });

  test("nsd-site home: the next 2 offline tournaments, ongoing included", async () => {
    expect(ids(await get("?online=false&limit=2"))).toEqual(["200", "302"]);
  });
});

describe("filters", () => {
  test("a from/to window returns a past month, by overlap", async () => {
    const from = Date.parse("2026-05-01T00:00:00Z");
    const to = Date.parse("2026-06-01T00:00:00Z");
    // 104 ends on May 1st, 103 starts on May 31st and ends in June: both overlap.
    expect(ids(await get(`?from=${from}&to=${to}`))).toEqual(["104", "101", "102", "103"]);
  });

  test("window edges: end_date == from is in, start_date == to is out", async () => {
    const t101 = at("2026-05-02T10:00:00Z");
    expect(ids(await get(`?from=${t101.endDate}&to=${t101.endDate + 1}`))).toEqual(["101"]);
    expect(ids(await get(`?from=${t101.startDate - DAY}&to=${t101.startDate}`))).toEqual([]);
  });

  test("online", async () => {
    expect(ids(await get("?online=true"))).toEqual(["301"]);
    expect(ids(await get("?from=0&online=true"))).toEqual(["102", "301"]);
  });

  test("url: every edition of a reused slug, newest first, past ones included", async () => {
    const r = await get("?url=fixture-reused");
    expect(ids(r)).toEqual(["402", "400", "401"]);
    expect(r.body.nextCursor).toBeNull();
    expect(ids(await get("?url=fixture-reused&limit=1"))).toEqual(["402"]);
    expect(ids(await get("?url=no-such-slug"))).toEqual([]);
  });

  test("limit: default 20, clamped to 100", async () => {
    const big = new TournamentRepository(openDatabase({ path: ":memory:" }));
    for (let i = 0; i < 130; i++) {
      big.upsert(tournament(String(1000 + i), { startDate: NOW + i * HOUR, endDate: NOW + i * HOUR + HOUR }));
    }
    const app = express();
    app.use("/api/tournaments", new TournamentApiRouter(() => big, () => NOW).router);
    const s = app.listen(0, "127.0.0.1");
    await new Promise((r) => s.once("listening", r));
    const prev = base;
    base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    try {
      expect((await get()).body.items).toHaveLength(20);
      const clamped = await get("?limit=1000");
      expect(clamped.body.items).toHaveLength(100);
      expect(clamped.body.nextCursor).not.toBeNull();
    } finally {
      base = prev;
      s.close();
    }
  });
});

describe("cursor pagination", () => {
  test("paging everything with from=0 visits every row exactly once, in order (ties included)", async () => {
    const all = repo.all().map((t) => t.id);
    for (const limit of [1, 2, 3, 5, 100]) {
      const { seen, pages } = await walk(`?from=0&limit=${limit}`);
      expect(seen).toEqual(all);
      expect(pages).toBe(Math.max(1, Math.ceil(all.length / limit)));
    }
  });

  test("a page boundary inside a start_date tie neither skips nor repeats", async () => {
    // 301 and 302 share a start date; split them across pages.
    const first = await get("?limit=2");
    expect(ids(first)).toEqual(["200", "301"]);
    const second = await get(`?limit=2&cursor=${first.body.nextCursor}`);
    expect(ids(second)).toEqual(["302", "303"]);
  });

  test("stable across inserts: new rows before the cursor don't shift the next page", async () => {
    const first = await get("?limit=2");
    expect(ids(first)).toEqual(["200", "301"]);
    // Posted while the client was scrolling: one before the cursor, one in the tie, one after.
    repo.upsert(tournament("250", at("2026-06-18T10:00:00Z")));
    repo.upsert(tournament("300", at("2026-06-20T10:00:00Z"))); // ties with 301/302 but sorts before 301
    repo.upsert(tournament("305", at("2026-06-21T10:00:00Z")));
    try {
      const rest: string[] = [];
      let cursor: string | null = first.body.nextCursor;
      while (cursor) {
        const r = await get(`?limit=2&cursor=${cursor}`);
        rest.push(...ids(r));
        cursor = r.body.nextCursor;
      }
      expect(rest).toEqual(["302", "305", "303", "402"]);
    } finally {
      seed();
    }
  });

  test("cursors are opaque base64url of (start_date, id)", () => {
    const c = encodeCursor({ startDate: 1, id: "x" });
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(c)).toEqual({ startDate: 1, id: "x" });
  });
});

describe("unknown parameters are ignored", () => {
  test.each([
    "?_=1700000000000",
    "?utm_source=newsletter&utm_medium=email",
    "?page=2",
    "?__proto__=x",
    "?__proto__[limit]=1",
    "?constructor=x&hasOwnProperty=1",
    "?toString=1&valueOf=2",
  ])("%s", async (query) => {
    const r = await get(query);
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual(ids(await get()));
  });

  test("known parameters still apply next to unknown ones, and __proto__ can't inject them", async () => {
    expect(ids(await get("?online=true&utm_source=x"))).toEqual(["301"]);
    expect((await get("?__proto__[online]=true&__proto__[limit]=1")).body.items).toHaveLength(5);
  });
});

describe("parameter validation", () => {
  test.each([
    ["?from=yesterday", /"from" must be a time in epoch milliseconds/],
    ["?from=-5", /"from"/],
    ["?to=1.5", /"to"/],
    ["?from=10&to=10", /"to" must be after "from"/],
    ["?online=yes", /"online" must be "true" or "false"/],
    ["?limit=0", /"limit" must be a positive integer/],
    ["?limit=ten", /"limit"/],
    ["?cursor=nope", /"cursor" is not valid/],
    [`?cursor=${Buffer.from('["x","1"]').toString("base64url")}`, /"cursor" is not valid/],
    ["?url=", /"url" must not be empty/],
    [`?url=fixture-reused&cursor=${encodeCursor({ startDate: 1, id: "1" })}`, /can't be combined/],
    ["?limit=5&limit=6", /given once/],
    ["?from[x]=1", /given once/],
  ])("%s → 400", async (query, message) => {
    const r = await get(query);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(message);
  });
});
