import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import express from "express";
import { readFileSync } from "fs";
import { request, type Server } from "http";
import type { AddressInfo } from "net";
import { join } from "path";
import { prepareImport, runImport } from "../scripts/lib/importFirestoreExport";
import { decodeMap, type CollectionExport } from "../scripts/lib/firestoreCodec";
import { openDatabase } from "../src/db/database";
import { TournamentRepository } from "../src/db/TournamentRepository";
import { CalendarRouter } from "../src/web/routers/Calendar.router";
import { TournamentRouter } from "../src/web/routers/Tournament.router";

const FIXTURE = join(import.meta.dir, "fixtures", "legacy-export");
const exported = JSON.parse(readFileSync(join(FIXTURE, "tournaments.json"), "utf8")) as CollectionExport;

/** What the old route sent: `JSON.stringify(cache.data)`, the decoded Firestore docs in export order. */
const oldRoute: Array<Record<string, unknown>> = JSON.parse(
  JSON.stringify(exported.docs.map((d) => decodeMap(d.data))),
);

const { report, quarantine } = runImport({ exportDir: FIXTURE, dbPath: "unused.db", dryRun: true });
const quarantined = new Set(quarantine.filter((q) => q.collection === "tournaments").map((q) => q.docId));
const defaultedById = new Map(report.tournamentDefaults.map((d) => [d.id, new Set(d.fields)]));
/** The doc each imported row came from. */
const sourceDocs = new Map(
  exported.docs.flatMap((d, i) => (quarantined.has(d.id) ? [] : [[String(d.data.id as number), oldRoute[i]] as const])),
);

// Same rows as the import, in a DB the routers read from.
const db = openDatabase({ path: ":memory:" });
const repo = new TournamentRepository(db);
repo.insertMany(prepareImport({ exportDir: FIXTURE, dbPath: "unused.db", dryRun: true }).tournaments);

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use("/tournaments", new TournamentRouter(() => repo).router);
  app.use("/calendar", new CalendarRouter(() => repo).router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

/** Plain http (the test preload disables fetch). */
const get = (path: string) =>
  new Promise<{ status: number; type: string; body: string }>((resolve, reject) => {
    request(`${base}${path}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, type: String(res.headers["content-type"]), body }));
    })
      .on("error", reject)
      .end();
  });

/** Fields every legacy consumer (agenda, nsd-site) reads, always present now. */
const ALWAYS = [
  "id",
  "url",
  "title",
  "image",
  "description",
  "location",
  "city",
  "locationID",
  "startDate",
  "endDate",
  "type",
  "isOnline",
  "nocap",
  "pr",
  "events",
  "prices",
];
/** Present only when set (NULL columns are left out, as absent fields were). */
const OPTIONAL = ["streamURL", "streamStartDate", "messageID", "guildEventID", "participants", "registrationClosesAt"];

describe("legacy GET /tournaments", () => {
  test("returns the old array shape, built from the same export", async () => {
    const res = await get("/tournaments");
    expect(res.status).toBe(200);
    const items = JSON.parse(res.body) as Array<Record<string, unknown>>;

    // Every exported doc but the quarantined ones, sorted by start date.
    expect(items).toHaveLength(oldRoute.length - quarantined.size);
    expect(new Set(items.map((t) => String(t.id)))).toEqual(new Set(sourceDocs.keys()));
    const starts = items.map((t) => t.startDate as number);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));

    for (const item of items) {
      const old = sourceDocs.get(String(item.id))!;
      const defaulted = defaultedById.get(String(item.id)) ?? new Set();

      for (const key of ALWAYS) {
        expect(item).toHaveProperty(key);
      }
      for (const key of Object.keys(item)) {
        expect([...ALWAYS, ...OPTIONAL]).toContain(key);
        expect(item[key]).not.toBeNull();
      }
      // start.gg's number, exactly as the old route sent it.
      expect(typeof item.id).toBe("number");
      expect(item.id).toBe(old.id);
      // A value the import didn't need to repair is exactly what the old route sent.
      for (const [key, value] of Object.entries(item)) {
        if (key !== "id" && !defaulted.has(key) && !["startDate", "endDate"].includes(key)) {
          expect([key, value]).toEqual([key, old[key]]);
        }
      }
      // Types the consumers rely on.
      expect(typeof item.startDate).toBe("number");
      expect(typeof item.endDate).toBe("number");
      expect(typeof item.isOnline).toBe("boolean");
      expect(typeof item.pr).toBe("boolean");
      expect(Array.isArray(item.events)).toBe(true);
      expect(typeof item.location).toBe("string");
      if ("streamURL" in item || "streamStartDate" in item) {
        expect(typeof item.streamURL).toBe("string");
        expect(typeof item.streamStartDate).toBe("number");
      }
    }

    // Plain ms dates were sent unchanged; Firestore Timestamps become ms.
    const plain = items.find((t) => t.id === 900002)!;
    expect([plain.startDate, plain.endDate]).toEqual([
      sourceDocs.get("900002")!.startDate,
      sourceDocs.get("900002")!.endDate,
    ]);
    expect(items.find((t) => t.id === 900007)?.startDate).toBe(1546344000500);
  });

  test("registrationClosesAt goes out in seconds, as start.gg sends it", async () => {
    repo.setStatus("900001", { participants: 12, registrationClosesAt: 4070900000000 });
    const items = JSON.parse((await get("/tournaments")).body) as Array<Record<string, unknown>>;
    expect(items.find((t) => t.id === 900001)).toMatchObject({ participants: 12, registrationClosesAt: 4070900000 });
    repo.setStatus("900001", { participants: null, registrationClosesAt: null });
  });
});

describe("GET /calendar/tournaments.ics", () => {
  test("serves the upcoming tournaments as iCalendar", async () => {
    const res = await get("/calendar/tournaments.ics");
    expect(res.status).toBe(200);
    expect(res.type).toContain("text/calendar");
    expect(res.body.startsWith("BEGIN:VCALENDAR")).toBe(true);

    const upcoming = repo.upcoming().map((t) => t.id);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(res.body.match(/BEGIN:VEVENT/g)?.length).toBe(upcoming.length);
    for (const id of upcoming) {
      expect(res.body).toContain(`UID:${id}@pgksmash.nl`);
    }
    expect(res.body).not.toContain("UID:900002@"); // 2019
  });

  test("a deleted tournament leaves the cached feed right away", async () => {
    const [first] = repo.upcoming();
    expect((await get("/calendar/tournaments.ics")).body).toContain(`UID:${first!.id}@`);
    repo.delete(first!.id);
    try {
      expect((await get("/calendar/tournaments.ics")).body).not.toContain(`UID:${first!.id}@`);
    } finally {
      repo.upsert(first!);
    }
    expect((await get("/calendar/tournaments.ics")).body).toContain(`UID:${first!.id}@`);
  });
});
