import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { prepareImport, runImport, writeReports } from "../scripts/lib/importFirestoreExport";
import { Store } from "../src/Store";

/** Synthetic export (test/fixtures/legacy-export): legacy shapes, duplicates, an empty doc. No real data. */
const FIXTURE = join(import.meta.dir, "fixtures", "legacy-export");
const SCRIPT = join(import.meta.dir, "..", "scripts", "import-firestore-export.ts");

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "import-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe("import of the fixture export", () => {
  test("dry run: counts, quarantine reasons and defaults", () => {
    const { report, quarantine } = runImport({ exportDir: FIXTURE, dbPath: "unused.db", dryRun: true });

    expect(report.db).toBe(":memory:");
    expect(report.collections.tournaments).toMatchObject({ exported: 11, imported: 8, quarantined: 3 });
    expect(report.collections.tournaments.quarantineReasons).toEqual({
      "missing id, url, title, startDate": 1,
      "duplicate id": 2,
    });
    expect(quarantine.map((q) => [q.collection, q.docId, q.reason])).toEqual([
      ["tournaments", "t05", "missing id, url, title, startDate"],
      ["tournaments", "t06", "duplicate id 900002 (kept doc t02)"], // older startDate loses
      ["tournaments", "t08", "duplicate id 900005 (kept doc t07)"], // tie: first in export order wins
      ["joinableroles", "jr4", "unknown category"],
    ]);
    // The raw doc is kept for review.
    expect(quarantine[1].doc.title).toBe("Fixture Legacy 2019 (first post)");

    const defaulted = report.collections.tournaments.defaulted;
    expect(defaulted.id).toBe(8);
    expect(defaulted.pr).toBe(7);
    expect(defaulted.isOnline).toBe(2);
    expect(defaulted.events).toBe(1);
    expect(defaulted.endDate).toBe(1);
    expect(report.collections.tournaments.droppedKeys).toEqual({ error: 7, lat: 1, lng: 1, smashggID: 1 });
    expect(report.tournamentDefaults.find((d) => d.docId === "t02")?.fields).toContain("isOnline");

    expect(report.collections.role_categories).toMatchObject({ exported: 2, imported: 2, quarantined: 0 });
    expect(report.collections.joinableroles).toMatchObject({
      exported: 4,
      imported: 3,
      quarantined: 1,
      defaulted: { description: 2 },
      droppedKeys: { categoryID: 1 },
    });
    expect(report.skippedCollections).toEqual(["botadmins"]);
  });

  test("normalized rows: both editions of a reused slug, converted legacy values", () => {
    const { tournaments, roles } = prepareImport({ exportDir: FIXTURE, dbPath: "unused.db", dryRun: true });
    const byId = new Map(tournaments.map((t) => [t.id, t]));

    expect(tournaments.filter((t) => t.url === "fixture-repost").map((t) => t.id)).toEqual(["900005", "900006"]);
    expect(byId.get("900002")).toMatchObject({ title: "Fixture Legacy 2019", pr: true, isOnline: false, messageID: null });
    expect(byId.get("900002")?.events).toEqual([{ name: "Singles", cap: "64" }]);
    expect(byId.get("900001")).toMatchObject({ location: "", city: "", locationID: "", prices: [] });
    expect(byId.get("900003")).toMatchObject({
      streamURL: "https://twitch.tv/fixture",
      streamStartDate: Date.parse("2023-07-01T14:00:00Z"),
    });
    expect(byId.get("900004")).toMatchObject({ streamURL: null, streamStartDate: null });
    expect(byId.get("900007")).toMatchObject({ startDate: 1546344000500, endDate: 1546365600000 });
    expect(byId.get("900008")).toMatchObject({ streamURL: null, streamStartDate: null });
    expect(byId.get("900008")?.endDate).toBe(byId.get("900008")?.startDate);
    expect(roles.map((r) => r.id)).toEqual(["100000000000000001", "100000000000000002", "100000000000000003"]);
  });

  test("writes a DB the bot can open, and refuses to overwrite it without force", () => {
    const dir = tempDir();
    const dbPath = join(dir, "sub", "turnipinator.db");
    runImport({ exportDir: FIXTURE, dbPath });
    expect(existsSync(`${dbPath}.importing`)).toBe(false);

    const store = new Store();
    store.init({ path: dbPath });
    expect(store.tournaments.count()).toBe(8);
    expect(store.roles.categories().map((c) => c.name)).toEqual(["Fixture Category", "Icons"]);
    expect(store.roles.rolesInCategory("Icons").map((r) => r.name)).toEqual(["fixture-icon"]);
    store.close();

    expect(() => runImport({ exportDir: FIXTURE, dbPath })).toThrow(/already exists.*--force/);
    const raw = new Database(dbPath);
    raw.run("DELETE FROM tournaments");
    raw.close();

    runImport({ exportDir: FIXTURE, dbPath, force: true });
    const again = new Database(dbPath, { readonly: true });
    expect(again.query("SELECT count(*) AS n FROM tournaments").get()).toEqual({ n: 8 });
    again.close();
  });

  test("a manifest that doesn't match the files stops the import before any DB is written", () => {
    const exportDir = tempDir();
    cpSync(FIXTURE, exportDir, { recursive: true });
    const manifestFile = join(exportDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest.counts.tournaments += 1;
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const dbPath = join(tempDir(), "x.db");

    expect(() => runImport({ exportDir, dbPath })).toThrow(/manifest\.json lists 12 docs/);
    expect(existsSync(dbPath)).toBe(false);
  });

  test("reports are written as JSON", () => {
    const dir = tempDir();
    writeReports(dir, runImport({ exportDir: FIXTURE, dbPath: "unused.db", dryRun: true }));
    expect(JSON.parse(readFileSync(join(dir, "import-report.json"), "utf8")).collections.tournaments.imported).toBe(8);
    expect(JSON.parse(readFileSync(join(dir, "quarantine.json"), "utf8"))).toHaveLength(4);
  });

  test("the CLI: dry run writes reports only; a real run writes the DB", () => {
    const dir = tempDir();
    const dbPath = join(dir, "cli.db");
    const run = (...args: string[]) =>
      Bun.spawnSync(["bun", "--no-env-file", SCRIPT, FIXTURE, `--db=${dbPath}`, `--report-dir=${join(dir, "reports")}`, ...args], {
        env: { PATH: process.env.PATH ?? "" },
      });

    const dry = run("--dry-run");
    expect(dry.exitCode).toBe(0);
    expect(dry.stdout.toString()).toContain("tournaments: exported 11, imported 8, quarantined 3");
    expect(existsSync(dbPath)).toBe(false);
    expect(existsSync(join(dir, "reports", "quarantine.json"))).toBe(true);

    expect(run().exitCode).toBe(0);
    expect(existsSync(dbPath)).toBe(true);
    const again = run();
    expect(again.exitCode).toBe(1);
    expect(again.stderr.toString()).toContain("--force");
    expect(run("--bogus").exitCode).toBe(2);
  });
});
