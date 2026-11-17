import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openDatabase } from "../src/db/database";
import type { NormalizedTournament } from "../src/db/normalizeTournament";
import { RoleRepository } from "../src/db/RoleRepository";
import { refreshTournamentStatus } from "../src/db/statusRefresh";
import { TournamentRepository } from "../src/db/TournamentRepository";
import { Store } from "../src/Store";

const HOUR = 3600000;
const NOW = Date.parse("2026-06-01T12:00:00Z");

const tournament = (id: string, overrides: Partial<NormalizedTournament> = {}): NormalizedTournament => ({
  id,
  url: `fixture-${id}`,
  title: `Fixture ${id}`,
  image: "",
  description: "",
  location: "",
  city: "",
  locationID: "",
  startDate: NOW + 24 * HOUR,
  endDate: NOW + 30 * HOUR,
  type: "smashgg",
  isOnline: true,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "" }],
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: null,
  guildEventID: null,
  ...overrides,
});

const memory = () => {
  const db = openDatabase({ path: ":memory:" });
  return { db, tournaments: new TournamentRepository(db), roles: new RoleRepository(db) };
};

describe("TournamentRepository", () => {
  test("insert, read back with JSON columns and booleans, update by id", () => {
    const { tournaments } = memory();
    const t = tournament("1", {
      events: [{ name: "Singles", cap: "64" }],
      prices: [{ name: "Entree", amount: 5 }],
      pr: true,
    });
    expect(tournaments.upsert(t)).toBe("inserted");
    expect(tournaments.getById("1")).toEqual({ ...t, participants: null, registrationClosesAt: null });

    expect(tournaments.upsert({ ...t, title: "Renamed", messageID: "3" })).toBe("updated");
    expect(tournaments.getById("1")?.title).toBe("Renamed");
    expect(tournaments.getById("1")?.messageID).toBe("3");
    expect(tournaments.count()).toBe(1);
    expect(tournaments.getById("nope")).toBeUndefined();
  });

  test("a reused url with a new id is a new row; lists are ordered by start date then id", () => {
    const { tournaments } = memory();
    tournaments.upsert(tournament("20", { url: "same-slug", startDate: NOW + 48 * HOUR, endDate: NOW + 50 * HOUR }));
    tournaments.upsert(tournament("10", { url: "same-slug" }));
    tournaments.upsert(tournament("11"));
    expect(tournaments.all().map((t) => t.id)).toEqual(["10", "11", "20"]);
  });

  test("upcoming() keeps tournaments that haven't ended", () => {
    const { tournaments } = memory();
    tournaments.upsert(tournament("past", { startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    tournaments.upsert(tournament("ongoing", { startDate: NOW - HOUR, endDate: NOW + HOUR }));
    tournaments.upsert(tournament("future"));
    expect(tournaments.upcoming(NOW).map((t) => t.id)).toEqual(["ongoing", "future"]);
  });

  test("the schema rejects rows that break the current shape", () => {
    const { tournaments } = memory();
    expect(() => tournaments.upsert(tournament("1", { endDate: NOW }))).toThrow(/CHECK/);
    expect(() => tournaments.upsert(tournament("2", { streamURL: "https://twitch.tv/x" }))).toThrow(/CHECK/);
    expect(() => tournaments.upsert(tournament("3", { streamStartDate: NOW }))).toThrow(/CHECK/);
    expect(() => tournaments.upsert(tournament("4", { location: null as unknown as string }))).toThrow(/NOT NULL/);
    expect(() => tournaments.upsert(tournament("5", { type: "other-type" as "other" }))).toThrow(/CHECK/);
    expect(tournaments.count()).toBe(0);
    tournaments.upsert(tournament("6", { streamURL: "https://twitch.tv/x", streamStartDate: NOW }));
    expect(tournaments.count()).toBe(1);
  });

  test("insertMany is all or nothing", () => {
    const { tournaments } = memory();
    expect(() => tournaments.insertMany([tournament("1"), tournament("1")])).toThrow(/UNIQUE/);
    expect(tournaments.count()).toBe(0);
  });

  test("status from the start.gg refresh survives a re-post", async () => {
    const { tournaments } = memory();
    tournaments.upsert(tournament("1"));
    tournaments.upsert(tournament("past", { startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));

    const asked: string[] = [];
    const updated = await refreshTournamentStatus(
      tournaments,
      async (id) => {
        asked.push(id);
        return [{ id, participants: 42, registrationClosesAt: 1780000000 as unknown as Date }];
      },
      NOW,
    );
    expect(asked).toEqual(["1"]);
    expect(updated).toBe(1);
    expect(tournaments.getById("1")).toMatchObject({ participants: 42, registrationClosesAt: 1780000000000 });

    tournaments.upsert(tournament("1", { title: "Re-posted" }));
    expect(tournaments.getById("1")).toMatchObject({
      title: "Re-posted",
      participants: 42,
      registrationClosesAt: 1780000000000,
    });
    expect(tournaments.setStatus("missing", { participants: 1, registrationClosesAt: null })).toBe(false);
  });
});

describe("RoleRepository", () => {
  test("categories and roles keep insertion order; roles need a known category", () => {
    const { roles } = memory();
    roles.addCategory({ name: "Regio", description: "Waar speel je?" });
    roles.addCategory({ name: "Icons", description: "" });
    roles.addRole({ id: "3", name: "Utrecht", category: "Regio", description: "" });
    roles.addRole({ id: "1", name: "Mario", category: "Icons", description: "" });
    roles.addRole({ id: "2", name: "Amsterdam", category: "Regio", description: "Hoofdstad" });

    expect(roles.categories().map((c) => c.name)).toEqual(["Regio", "Icons"]);
    expect(roles.roles().map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(roles.rolesInCategory("Regio").map((r) => r.name)).toEqual(["Utrecht", "Amsterdam"]);
    expect(() => roles.addRole({ id: "4", name: "Ghost", category: "Nope", description: "" })).toThrow(/FOREIGN KEY/);
    expect(() => roles.addRole({ id: "5", name: "Mario", category: "Icons", description: "" })).toThrow(/UNIQUE/);
  });
});

describe("Store", () => {
  test("opens the DB once and refuses a missing file unless asked to create it", () => {
    const s = new Store();
    expect(() => s.tournaments).toThrow(/not open/);
    expect(() => s.init({ path: "/nonexistent-dir/turnipinator.db" })).toThrow(/No SQLite database/);

    s.init({ path: ":memory:" });
    expect(s.tournaments.count()).toBe(0);
    expect(() => s.init({ path: ":memory:" })).toThrow(/already open/);
    s.close();
  });

  test("uses WAL and foreign keys on a file DB", () => {
    const dir = mkdtempSync(join(tmpdir(), "store-test-"));
    const path = join(dir, "test.db");
    const s = new Store();
    s.init({ path, create: true });
    const client = s.db.$client;
    expect(client.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    expect(client.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
