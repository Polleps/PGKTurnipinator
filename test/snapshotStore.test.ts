import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { Store, store } from "../src/Store";
import { resolveDataSource, SnapshotInProductionError } from "../src/stores/dataSource";
import { BasicMapCache, TournamentStoreCache } from "../src/stores";
import { loadSnapshotCollection, SnapshotCollection } from "../src/stores/snapshot/SnapshotCollection";
import { SnapshotTimestamp } from "../src/stores/snapshot/codec";
import type ITournament from "../src/models/ITournament";

const FIXTURE = process.env.FIRESTORE_SNAPSHOT as string;
const fixtureText = () =>
  ["joinableroles", "role_categories", "tournaments"].map((c) =>
    readFileSync(join(FIXTURE, `${c}.json`), "utf8"),
  );

const quiet = () => spyOn(console, "log").mockImplementation(() => {});

const newStore = async (env: NodeJS.ProcessEnv = { NODE_ENV: "development", FIRESTORE_SNAPSHOT: FIXTURE }) => {
  const s = Store.create({ env, tournamentCollection: "tournaments" });
  await s.init();
  return s;
};

const tournament = (id: string, title = "New"): ITournament => ({
  id,
  url: `new-${id}`,
  title,
  events: [],
  location: "",
  city: "",
  locationID: "",
  startDate: new Date("2099-06-01T10:00:00Z"),
  endDate: new Date("2099-06-01T20:00:00Z"),
  type: "smashgg",
  isOnline: true,
});

describe("data source selection", () => {
  test("live unless FIRESTORE_SNAPSHOT is set", () => {
    expect(resolveDataSource({ NODE_ENV: "production" })).toEqual({ kind: "live" });
    expect(resolveDataSource({ NODE_ENV: "development", FIRESTORE_SNAPSHOT: "" })).toEqual({ kind: "live" });
    expect(resolveDataSource({ FIRESTORE_SNAPSHOT: "/x/y" })).toEqual({ kind: "snapshot", dir: "/x/y" });
  });

  test("refuses snapshot mode together with NODE_ENV=production", () => {
    expect(() => resolveDataSource({ NODE_ENV: "production", FIRESTORE_SNAPSHOT: FIXTURE })).toThrow(
      SnapshotInProductionError,
    );
    // The Store fails before opening any collection (firebase-admin would throw a different error).
    expect(() =>
      Store.create({ env: { NODE_ENV: "production", FIRESTORE_SNAPSHOT: FIXTURE }, tournamentCollection: "tournaments" }),
    ).toThrow(/Refusing to start/);
  });
});

describe("snapshot mode", () => {
  test("the store singleton loads from the fixture without firebase-admin", () => {
    // The preload blocks firebase-admin, so importing Store at all proves it was not loaded.
    expect(store.source.kind).toBe("snapshot");
  });

  test("loads every cache from the export", async () => {
    const log = quiet();
    const s = await newStore();
    log.mockRestore();

    const roles = s.cache("joinableroles") as BasicMapCache<any>;
    expect([...roles.data.keys()].sort()).toEqual(["fixture-role-a", "fixture-role-b"]);
    expect(roles.get("fixture-role-b")?.description).toBe("Fake role");

    const categories = s.cache("role_categories") as BasicMapCache<any>;
    expect(categories.get("Fixture Category")?.description).toBe("Fake category for tests");

    expect(s.cache("botadmins")).toBeUndefined();

    const tournaments = s.cache("tournaments") as TournamentStoreCache;
    expect(tournaments.collectionId).toBe("tournaments");
    expect(tournaments.data.map((t) => t.url)).toEqual(["fixture-past", "fixture-upcoming", "fixture-legacy"]);
    expect(tournaments.getUpcoming().map((t) => t.url)).toEqual(["fixture-upcoming"]);
    const legacy = tournaments.getByID("900003") as any;
    expect(legacy.startDate).toBeInstanceOf(SnapshotTimestamp);
    expect(legacy.startDate.toDate().toISOString()).toBe("2019-01-01T12:00:00.500Z");
    expect(legacy.where.latitude).toBe(52.0907);
    expect(legacy.organizer.path).toBe("organizers/fixture-org");
  });

  test("caches are writable, but writes stay in memory and are logged", async () => {
    const before = fixtureText();
    const log = quiet();
    const s = await newStore();

    const roles = s.cache("joinableroles") as BasicMapCache<any>;
    expect(roles.writable).toBe(true);
    await roles.add({ name: "fixture-role-c", category: "Fixture Category", categoryID: "rc1", ID: "3" });
    expect(roles.has("fixture-role-c")).toBe(true);

    const tournaments = s.cache("tournaments") as TournamentStoreCache;
    await tournaments.add(tournament("777"));
    await tournaments.add(tournament("777", "Renamed"));
    expect(tournaments.getByID("777")?.title).toBe("Renamed");

    // A forced refill re-reads the in-memory snapshot (never Firestore) and keeps the writes.
    await tournaments.updateCache();
    const refilled = tournaments.getByID("777") as any;
    expect(refilled.title).toBe("Renamed");
    expect(refilled.startDate).toBeInstanceOf(SnapshotTimestamp); // Date stored as Timestamp, like Firestore

    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith("[snapshot] would write"));
    log.mockRestore();
    expect(lines.map((l) => l.split(" ")[3] + " " + l.split(" ")[4].split("/")[0])).toEqual([
      "add joinableroles",
      "add tournaments",
      "update tournaments",
    ]);

    // Nothing was persisted, and a fresh store sees the original data.
    expect(fixtureText()).toEqual(before);
    const quiet2 = quiet();
    const fresh = await newStore();
    quiet2.mockRestore();
    expect((fresh.cache("joinableroles") as BasicMapCache<any>).has("fixture-role-c")).toBe(false);
    expect((fresh.cache("tournaments") as TournamentStoreCache).getByID("777")).toBeUndefined();
  });

  test("the snapshot collection rejects undefined like Firestore", async () => {
    const col = new SnapshotCollection("c", [{ id: "a", data: { x: 1 } }], () => {});
    await expect(col.add({ x: undefined })).rejects.toThrow(/undefined/);
    expect(() => col.doc("a").update({ y: undefined })).toThrow(/undefined/);
    expect((await col.get()).size).toBe(1);
  });

  test("a missing collection file fails clearly", () => {
    expect(() => loadSnapshotCollection(FIXTURE, "tournaments_dev")).toThrow(/--include-dev/);
  });
});
