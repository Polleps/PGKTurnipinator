import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { S3Client } from "bun";
import { createLogger } from "../utils/logger";
import { isMemoryPath } from "./database";

const log = createLogger("Backup");

/** Every night at 04:00 Amsterdam time (DST-aware; Bun.cron interprets the expression in `tz`). */
export const BACKUP_SCHEDULE = "0 4 * * *";
export const BACKUP_TIME_ZONE = "Europe/Amsterdam";
/** Local snapshots kept next to the DB; older ones are pruned after each backup. */
export const BACKUP_KEEP = 7;

const NAME_PREFIX = "turnipinator-";
const SNAPSHOT_PATTERN = /^turnipinator-\d{4}-\d{2}-\d{2}\.db$/;
const TEMP_PATTERN = /^\.turnipinator-.*\.tmp$/;

export interface S3Target {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface BackupConfig {
  /** The live DB file. */
  dbPath: string;
  /** Where local snapshots go (BACKUP_DIR, else `backups/` next to the DB). */
  dir: string;
  keep: number;
  /** Off-site copy (e.g. Cloudflare R2). Undefined: local snapshots only. */
  s3?: S3Target;
}

/** Uploads one gzipped snapshot under `key`. Injectable so tests never touch the network. */
export type Upload = (key: string, data: Uint8Array<ArrayBuffer>) => Promise<void>;

export interface BackupResult {
  file: string;
  bytes: number;
  /** Object key of the off-site copy, when one was uploaded. */
  remoteKey?: string;
  pruned: string[];
}

type Env = Record<string, string | undefined>;

const S3_VARS = {
  bucket: "BACKUP_S3_BUCKET",
  endpoint: "BACKUP_S3_ENDPOINT",
  accessKeyId: "BACKUP_S3_ACCESS_KEY_ID",
  secretAccessKey: "BACKUP_S3_SECRET_ACCESS_KEY",
} as const;

/**
 * Reads the backup settings. The S3 target is only set when all four BACKUP_S3_* vars are;
 * a partial set is reported in `missing` (and treated as no upload) rather than thrown,
 * so a typo can't stop the bot.
 */
export const backupConfigFromEnv = (dbPath: string, env: Env = process.env): BackupConfig & { missing: string[] } => {
  const values = Object.fromEntries(
    Object.entries(S3_VARS).map(([field, name]) => [field, env[name]?.trim() || undefined]),
  ) as Partial<S3Target>;
  const missing = Object.entries(S3_VARS)
    .filter(([field]) => !values[field as keyof S3Target])
    .map(([, name]) => name);
  const allSet = missing.length === 0;
  return {
    dbPath: resolve(dbPath),
    dir: resolve(env.BACKUP_DIR?.trim() || join(dirname(resolve(dbPath)), "backups")),
    keep: BACKUP_KEEP,
    s3: allSet ? (values as S3Target) : undefined,
    missing: allSet || missing.length === Object.keys(S3_VARS).length ? [] : missing,
  };
};

/** The calendar day in Amsterdam, as YYYY-MM-DD (a 04:00 run is dated that same day). */
export const backupDate = (now: Date, timeZone: string = BACKUP_TIME_ZONE): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export const snapshotName = (date: string): string => `${NAME_PREFIX}${date}.db`;
export const remoteKey = (date: string): string => `backups/${snapshotName(date)}.gz`;

/** Uploads with Bun's built-in S3 client. R2 ignores the region, but SigV4 needs one: "auto". */
export const s3Upload =
  (target: S3Target): Upload =>
  async (key, data) => {
    const client = new S3Client({ ...target, region: "auto" });
    await client.write(key, data, { type: "application/gzip" });
  };

/** A temp file this old is left over from a crashed run, not one in progress. */
const STALE_TEMP_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes all but the newest `keep` snapshots in `dir` (by the date in the name), plus temp
 * files left behind by a crashed run. Only touches files named like this module's own.
 */
export const pruneSnapshots = (dir: string, keep: number, now: number = Date.now()): string[] => {
  const names = readdirSync(dir);
  const stale = names.filter((n) => TEMP_PATTERN.test(n) && now - statSync(join(dir, n)).mtimeMs > STALE_TEMP_MS);
  const old = names
    .filter((n) => SNAPSHOT_PATTERN.test(n))
    .sort()
    .reverse()
    .slice(Math.max(keep, 1));
  for (const name of [...stale, ...old]) {
    rmSync(join(dir, name), { force: true });
  }
  return old;
};

/**
 * Takes a consistent snapshot of the live DB with `VACUUM INTO` (a read transaction, so the
 * bot keeps writing under WAL), checks it, renames it to `turnipinator-<date>.db`, uploads a
 * gzipped copy when an upload is given, and prunes old local snapshots. Throws on failure;
 * a snapshot that was written stays even when the upload fails.
 */
export const createBackup = async (
  db: Database,
  config: BackupConfig,
  { now = new Date(), upload }: { now?: Date; upload?: Upload } = {},
): Promise<BackupResult> => {
  mkdirSync(config.dir, { recursive: true });
  const date = backupDate(now);
  const file = join(config.dir, snapshotName(date));
  // In the backup dir, so the rename below stays on one file system.
  const temp = join(config.dir, `.${snapshotName(date)}.${process.pid}.tmp`);
  rmSync(temp, { force: true });
  try {
    db.run("VACUUM INTO ?", [temp]);
    checkSnapshot(temp);
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
  const bytes = statSync(file).size;

  let uploadedKey: string | undefined;
  if (upload) {
    uploadedKey = remoteKey(date);
    await upload(uploadedKey, Bun.gzipSync(await Bun.file(file).bytes()));
  }
  const pruned = pruneSnapshots(config.dir, config.keep);
  return { file, bytes, remoteKey: uploadedKey, pruned };
};

const checkSnapshot = (path: string): void => {
  const copy = new Database(path, { readonly: true });
  try {
    const row = copy.query("PRAGMA quick_check").get() as { quick_check: string } | null;
    if (row?.quick_check !== "ok") {
      throw new Error(`snapshot failed quick_check: ${row?.quick_check ?? "no result"}`);
    }
  } finally {
    copy.close();
  }
};

/** Runs one backup and logs the outcome; never throws (a failed backup must not stop the bot). */
export const runBackup = async (db: Database, config: BackupConfig, now: Date = new Date()): Promise<boolean> => {
  try {
    const result = await createBackup(db, config, { now, upload: config.s3 ? s3Upload(config.s3) : undefined });
    const remote = result.remoteKey ? `, uploaded to ${config.s3!.bucket}/${result.remoteKey}` : "";
    const pruned = result.pruned.length > 0 ? `, pruned ${result.pruned.join(", ")}` : "";
    log(`Wrote ${result.file} (${result.bytes} bytes)${remote}${pruned}.`);
    return true;
  } catch (e) {
    log(`Backup failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return false;
  }
};

/**
 * Schedules the nightly backup in-process with Bun.cron, when BACKUP_ENABLED=true.
 * Returns the job (to stop it), or undefined when backups are off.
 */
export const startBackupSchedule = (db: Database, dbPath: string, env: Env = process.env): Bun.CronJob | undefined => {
  if (env.BACKUP_ENABLED !== "true") {
    log("Nightly backup disabled (set BACKUP_ENABLED=true to enable).");
    return undefined;
  }
  if (isMemoryPath(dbPath)) {
    log("Nightly backup disabled: the DB is in memory.");
    return undefined;
  }
  const config = backupConfigFromEnv(dbPath, env);
  if (!existsSync(config.dbPath)) {
    log(`Nightly backup disabled: ${config.dbPath} is not a DB file.`);
    return undefined;
  }
  if (config.missing.length > 0) {
    log(`Remote upload disabled: incomplete S3 settings, missing ${config.missing.join(", ")}.`);
  } else if (!config.s3) {
    log("Remote upload disabled: BACKUP_S3_* not set; keeping local snapshots only.");
  }
  // runBackup catches everything, so the job never emits an unhandled rejection.
  const job = Bun.cron(BACKUP_SCHEDULE, () => runBackup(db, config), { tz: BACKUP_TIME_ZONE }).unref();
  const next = Bun.cron.parse(BACKUP_SCHEDULE, Date.now(), { tz: BACKUP_TIME_ZONE });
  log(
    `Nightly backup of ${config.dbPath} to ${config.dir} at ${BACKUP_SCHEDULE} ${BACKUP_TIME_ZONE}` +
      `${config.s3 ? ` and ${config.s3.bucket}` : ""}; next run ${next?.toISOString() ?? "never"}.`,
  );
  return job;
};
