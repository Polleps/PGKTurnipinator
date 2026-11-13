import { describe, expect, test } from "bun:test";
import {
  BasicMapCache,
  BasicSetCache,
  DEV_WRITABLE_COLLECTIONS,
  isCollectionWritable,
  ReadOnlyCollectionError,
  TournamentStoreCache,
} from "../src/stores";
import type ITournament from "../src/models/ITournament";
import { fakeCollection } from "./fakeCollection";

const tournament = (id: string): ITournament => ({
  id,
  url: "test",
  title: "Test",
  events: [],
  location: "",
  city: "",
  locationID: "",
  startDate: new Date("2099-01-01T10:00:00Z"),
  endDate: new Date("2099-01-01T20:00:00Z"),
  type: "smashgg",
  isOnline: true,
});

describe("isCollectionWritable", () => {
  test("only tournaments_dev is writable outside production", () => {
    expect([...DEV_WRITABLE_COLLECTIONS]).toEqual(["tournaments_dev"]);
    for (const env of ["development", "test", "", undefined, "Production", "prod"]) {
      expect(isCollectionWritable("tournaments_dev", env)).toBe(true);
      expect(isCollectionWritable("tournaments", env)).toBe(false);
      expect(isCollectionWritable("joinableroles", env)).toBe(false);
      expect(isCollectionWritable("botadmins", env)).toBe(false);
    }
  });

  test("everything is writable in production", () => {
    expect(isCollectionWritable("tournaments", "production")).toBe(true);
    expect(isCollectionWritable("joinableroles", "production")).toBe(true);
  });

  test("defaults to process.env.NODE_ENV and fails closed", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(isCollectionWritable("tournaments")).toBe(false);
  });
});

describe("read-only caches", () => {
  test("BasicSetCache refuses add/delete without touching the collection", async () => {
    const { ref, writes } = fakeCollection("botadmins", [{ id: "1" }]);
    const cache = new BasicSetCache(ref, "id");
    await cache.init();
    expect(cache.writable).toBe(false);
    expect(cache.has("1")).toBe(true);

    await expect(cache.add("2")).rejects.toBeInstanceOf(ReadOnlyCollectionError);
    await expect(cache.delete("1")).rejects.toThrow(/read-only outside NODE_ENV=production/);
    expect(writes).toEqual([]);
    expect(cache.has("2")).toBe(false);
    expect(cache.has("1")).toBe(true);
  });

  test("BasicMapCache refuses add", async () => {
    const { ref, writes } = fakeCollection("joinableroles", [{ name: "a" }]);
    const cache = new BasicMapCache<{ name: string }>(ref, "name");
    await cache.init();
    expect(cache.get("a")).toEqual({ name: "a" });

    await expect(cache.add({ name: "b" })).rejects.toBeInstanceOf(ReadOnlyCollectionError);
    expect(writes).toEqual([]);
    expect(cache.has("b")).toBe(false);
  });

  test("TournamentStoreCache refuses insert and update on the prod collection", async () => {
    const { ref, writes } = fakeCollection("tournaments");
    const cache = new TournamentStoreCache(ref);

    await expect(cache.add(tournament("1"))).rejects.toBeInstanceOf(ReadOnlyCollectionError);
    expect(writes).toEqual([]);
    expect(cache.getByID("1")).toBeUndefined();
  });

  test("an explicit writable=false wins even in production", async () => {
    const { ref, writes } = fakeCollection("tournaments");
    const cache = new TournamentStoreCache(ref, false);
    await expect(cache.add(tournament("1"))).rejects.toThrow(ReadOnlyCollectionError);
    expect(writes).toEqual([]);
  });
});

describe("writable caches", () => {
  test("tournaments_dev accepts writes outside production", async () => {
    const { ref, writes } = fakeCollection("tournaments_dev");
    const cache = new TournamentStoreCache(ref);
    expect(cache.writable).toBe(true);

    await cache.add(tournament("1"));
    expect(writes).toEqual(["add"]);
    expect(cache.getByID("1")?.title).toBe("Test");

    await cache.add({ ...tournament("1"), title: "Renamed" });
    expect(writes).toEqual(["add", "update"]);
    expect(cache.getByID("1")?.title).toBe("Renamed");
  });

  test("production caches write through", async () => {
    const { ref, writes } = fakeCollection("botadmins");
    const cache = new BasicSetCache(ref, "id", isCollectionWritable("botadmins", "production"));
    await cache.add("2");
    expect(writes).toEqual(["add"]);
    expect(cache.has("2")).toBe(true);
  });
});
