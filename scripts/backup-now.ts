/**
 * Takes one backup now, the same way the bot's nightly job does: a `VACUUM INTO` snapshot in
 * the backup dir, a gzipped upload when BACKUP_S3_* is set, and pruning to the last 7.
 *
 *   bun run backup:now                 # .env.dev
 *   NODE_ENV=production bun run backup:now
 *   bun run backup:now --local-only    # skip the upload
 *
 * Runs regardless of BACKUP_ENABLED. Safe while the bot is running: it opens the DB read-only
 * (no migrations) and VACUUM INTO only reads. Run it as the user that owns the data dir.
 */
import "../src/env";
import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { BUSY_TIMEOUT_MS, DEFAULT_DATABASE_PATH } from "../src/db/database";
import { backupConfigFromEnv, runBackup } from "../src/db/backup";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--local-only");
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(" ")}\nUsage: bun run backup:now [--local-only]`);
  process.exit(2);
}

const config = backupConfigFromEnv(process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH);
if (!existsSync(config.dbPath)) {
  console.error(`No SQLite database at ${config.dbPath}.`);
  process.exit(1);
}
if (config.missing.length > 0) {
  console.error(`Incomplete S3 settings, missing ${config.missing.join(", ")}.`);
  process.exit(1);
}
if (args.includes("--local-only") || !config.s3) {
  console.log("Remote upload disabled; local snapshot only.");
  config.s3 = undefined;
}

const db = new Database(config.dbPath, { readonly: true });
db.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
const ok = await runBackup(db, config);
db.close();
process.exit(ok ? 0 : 1);
