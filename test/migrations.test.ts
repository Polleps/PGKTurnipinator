import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runMigrations } from "../src/db/database";

const DATABASE_TS = join(import.meta.dir, "..", "src", "db", "database.ts");

const dirs: string[] = [];
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe("migrations", () => {
  test("apply once; a second run finds nothing to do", () => {
    const db = new Database(":memory:");
    expect(runMigrations(db)).toBeGreaterThan(0);
    expect(runMigrations(db)).toBe(0);
    expect(db.query("SELECT count(*) AS n FROM tournaments").get()).toEqual({ n: 0 });
    db.close();
  });

  test("several processes opening a new DB at once all start, and migrate it exactly once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-race-"));
    dirs.push(dir);
    const path = join(dir, "race.db");
    const script = `
      const { openDatabase } = require(${JSON.stringify(DATABASE_TS)});
      const db = openDatabase({ path: ${JSON.stringify(path)}, create: true });
      db.$client.close(true);
    `;
    const procs = Array.from({ length: 6 }, () =>
      Bun.spawn(["bun", "--no-env-file", "-e", script], { stdout: "pipe", stderr: "pipe" }),
    );
    const codes = await Promise.all(procs.map((p) => p.exited));
    const errors = await Promise.all(procs.map((p) => new Response(p.stderr).text()));
    expect(errors.filter((e) => e.trim() !== "")).toEqual([]);
    expect(codes).toEqual([0, 0, 0, 0, 0, 0]);

    const db = new Database(path, { readonly: true });
    const applied = db.query('SELECT count(*) AS n FROM "__drizzle_migrations"').get() as { n: number };
    expect(applied.n).toBe(1);
    expect(db.query("SELECT count(*) AS n FROM tournaments").get()).toEqual({ n: 0 });
    db.close();
  }, 20000);
});
