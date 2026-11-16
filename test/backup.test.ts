import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openDatabase } from "../src/db/database";
import {
  backupConfigFromEnv,
  backupDate,
  createBackup,
  pruneSnapshots,
  runBackup,
  startBackupSchedule,
  type BackupConfig,
} from "../src/db/backup";

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "backup-test-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

const S3_ENV = {
  BACKUP_S3_BUCKET: "bucket",
  BACKUP_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  BACKUP_S3_ACCESS_KEY_ID: "id",
  BACKUP_S3_SECRET_ACCESS_KEY: "secret",
};

/** A migrated WAL DB file with one probe row, kept open like the bot keeps it. */
const liveDb = (dir: string) => {
  const path = join(dir, "turnipinator.db");
  const db = openDatabase({ path, create: true });
  db.$client.run("CREATE TABLE probe (name TEXT NOT NULL)");
  db.$client.run("INSERT INTO probe VALUES ('first')");
  return { path, sqlite: db.$client };
};

const config = (dir: string, dbPath: string, keep = 7): BackupConfig => ({ dbPath, dir, keep });

describe("backup config", () => {
  test("defaults the dir to backups/ next to the DB, no upload without S3 vars", () => {
    const c = backupConfigFromEnv("/srv/data/turnipinator.db", {});
    expect(c.dir).toBe("/srv/data/backups");
    expect(c.s3).toBeUndefined();
    expect(c.missing).toEqual([]);
  });

  test("uses BACKUP_DIR and all four S3 vars", () => {
    const c = backupConfigFromEnv("/srv/data/turnipinator.db", { ...S3_ENV, BACKUP_DIR: "/var/backups/t" });
    expect(c.dir).toBe("/var/backups/t");
    expect(c.s3).toEqual({
      bucket: "bucket",
      endpoint: "https://account.r2.cloudflarestorage.com",
      accessKeyId: "id",
      secretAccessKey: "secret",
    });
  });

  test("a partial S3 set disables the upload and names what is missing", () => {
    const c = backupConfigFromEnv("/db", { ...S3_ENV, BACKUP_S3_SECRET_ACCESS_KEY: " " });
    expect(c.s3).toBeUndefined();
    expect(c.missing).toEqual(["BACKUP_S3_SECRET_ACCESS_KEY"]);
  });

  test("dates by the Amsterdam calendar day", () => {
    expect(backupDate(new Date("2026-11-16T03:00:00Z"))).toBe("2026-11-16");
    expect(backupDate(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
  });
});

describe("createBackup", () => {
  test("snapshots the live WAL DB with VACUUM INTO, including uncheckpointed writes", async () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    const backups = join(dir, "backups");

    const result = await createBackup(sqlite, config(backups, path), { now: new Date("2026-11-16T03:00:00Z") });

    expect(result.file).toBe(join(backups, "turnipinator-2026-11-16.db"));
    expect(result.remoteKey).toBeUndefined();
    expect(readdirSync(backups)).toEqual(["turnipinator-2026-11-16.db"]);
    const copy = new Database(result.file, { readonly: true });
    expect(copy.query("SELECT name FROM probe").all()).toEqual([{ name: "first" }]);
    expect(copy.query("SELECT count(*) AS n FROM tournaments").get()).toEqual({ n: 0 });
    expect(copy.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "delete" });
    copy.close();
    sqlite.close();
  });

  test("a second run on the same day replaces that day's snapshot", async () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    const now = new Date("2026-11-16T03:00:00Z");
    await createBackup(sqlite, config(dir, path), { now });
    sqlite.run("INSERT INTO probe VALUES ('second')");
    const { file } = await createBackup(sqlite, config(dir, path), { now });

    const copy = new Database(file, { readonly: true });
    expect(copy.query("SELECT count(*) AS n FROM probe").get()).toEqual({ n: 2 });
    copy.close();
    sqlite.close();
  });

  test("uploads a gzipped copy under a dated key", async () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    const uploads: { key: string; data: Uint8Array<ArrayBuffer> }[] = [];

    const result = await createBackup(sqlite, config(join(dir, "b"), path), {
      now: new Date("2026-11-16T03:00:00Z"),
      upload: async (key, data) => {
        uploads.push({ key, data });
      },
    });

    expect(result.remoteKey).toBe("backups/turnipinator-2026-11-16.db.gz");
    expect(uploads.map((u) => u.key)).toEqual(["backups/turnipinator-2026-11-16.db.gz"]);
    const restored = Bun.gunzipSync(uploads[0]!.data);
    expect(restored).toEqual(await Bun.file(result.file).bytes());
    sqlite.close();
  });

  test("a failed upload throws but keeps the local snapshot", async () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    const backups = join(dir, "b");
    const upload = () => Promise.reject(new Error("R2 down"));

    const error = await createBackup(sqlite, config(backups, path), { upload }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("R2 down");
    expect(readdirSync(backups).filter((n) => n.endsWith(".db"))).toHaveLength(1);
    expect(readdirSync(backups).filter((n) => n.endsWith(".tmp"))).toEqual([]);
    sqlite.close();
  });

  test("runBackup logs failures instead of throwing", async () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    sqlite.close();
    expect(await runBackup(sqlite, config(join(dir, "b"), path))).toBe(false);
  });
});

describe("pruneSnapshots", () => {
  test("keeps the newest N snapshots and leaves unrelated files alone", () => {
    const dir = tempDir();
    const days = ["2026-11-01", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
    for (const d of days) {
      writeFileSync(join(dir, `turnipinator-${d}.db`), "");
    }
    writeFileSync(join(dir, "notes.txt"), "");
    writeFileSync(join(dir, "turnipinator.db"), "");

    expect(pruneSnapshots(dir, 3).sort()).toEqual([
      "turnipinator-2026-11-01.db",
      "turnipinator-2026-11-09.db",
      "turnipinator-2026-11-10.db",
    ]);
    expect(readdirSync(dir).sort()).toEqual([
      "notes.txt",
      "turnipinator-2026-11-11.db",
      "turnipinator-2026-11-12.db",
      "turnipinator-2026-11-13.db",
      "turnipinator.db",
    ]);
  });

  test("removes temp files from crashed runs, but not one in progress", () => {
    const dir = tempDir();
    const stale = join(dir, ".turnipinator-2026-11-01.db.123.tmp");
    const fresh = join(dir, ".turnipinator-2026-11-16.db.456.tmp");
    writeFileSync(stale, "");
    writeFileSync(fresh, "");
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(stale, twoDaysAgo, twoDaysAgo);

    pruneSnapshots(dir, 7);
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });
});

describe("startBackupSchedule", () => {
  test("schedules nothing unless BACKUP_ENABLED=true", () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    expect(startBackupSchedule(sqlite, path, {})).toBeUndefined();
    sqlite.close();
  });

  test("schedules nothing for an in-memory DB", () => {
    const sqlite = new Database(":memory:");
    expect(startBackupSchedule(sqlite, ":memory:", { BACKUP_ENABLED: "true" })).toBeUndefined();
    sqlite.close();
  });

  test("schedules a Bun.cron job when enabled", () => {
    const dir = tempDir();
    const { path, sqlite } = liveDb(dir);
    const job = startBackupSchedule(sqlite, path, { BACKUP_ENABLED: "true" });
    expect(job?.cron).toBe("0 4 * * *");
    job?.stop();
    sqlite.close();
  });
});
