/**
 * One-off: forgets the stored agenda message id of every ended tournament (end_date <= cutoff)
 * except `borderline-smash-71`, whose message was kept on purpose to test the daily cleanup.
 * The other messages were already deleted from Discord by hand. Never contacts Discord and never
 * deletes rows: it only sets message_id to NULL.
 *
 *   bun run clear:ended-message-ids                 # dry run (.env.dev)
 *   bun run clear:ended-message-ids --apply
 *   NODE_ENV=production bun run clear:ended-message-ids --before=2026-11-18T09:00:00+01:00 [--apply]
 *
 * Options:
 *   --db=<file>             DB file (default: $DATABASE_PATH, else data/turnipinator.db).
 *   --before=<ISO datetime> Only tournaments that ended at or before this moment (default: now).
 *                           Use the time of the manual Discord cleanup, so a tournament that ended
 *                           after it (its message still live) keeps its id for the daily job.
 *   --apply                 Write the change (one transaction). Without it nothing is written.
 *
 * Prints the cutoff and every row it clears (newest end first), then the count.
 *
 * Safe while the bot is running: SQLite in WAL mode, a busy timeout, and an IMMEDIATE write
 * transaction. Opens the DB without running migrations. Run it as the user that owns the data dir.
 */
import "../src/env";
import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { resolve } from "path";
import { BUSY_TIMEOUT_MS, DEFAULT_DATABASE_PATH } from "../src/db/database";
import { applyClear, ClearError, planClear, type EndedRow } from "./lib/clearEndedMessageIds";

const KEEP_SLUG = "borderline-smash-71";

const usage = (message: string): never => {
  console.error(`${message}\nUsage: bun run clear:ended-message-ids [--before=<ISO datetime>] [--apply] [--db=<file>]`);
  process.exit(2);
};

let apply = false;
let dbArg: string | undefined;
let cutoff = Date.now();
for (const arg of process.argv.slice(2)) {
  if (arg === "--apply") {
    apply = true;
  } else if (arg.startsWith("--db=") && arg.length > "--db=".length) {
    dbArg = arg.slice("--db=".length);
  } else if (arg.startsWith("--before=")) {
    const value = arg.slice("--before=".length);
    const parsed = /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
    if (!Number.isFinite(parsed)) {
      usage(`--before must be an ISO datetime like 2026-11-18T09:00:00+01:00, got "${value}"`);
    }
    cutoff = parsed;
  } else {
    usage(`Unknown argument: ${arg}`);
  }
}

const dbPath = resolve(dbArg || process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH);
if (!existsSync(dbPath)) {
  console.error(`No SQLite database at ${dbPath}.`);
  process.exit(1);
}

const describeRow = (r: EndedRow) => `${r.id} ${r.url} "${r.title}" (ended ${new Date(r.endDate).toISOString()})`;

const db = new Database(dbPath, { readwrite: true, create: false, strict: true });
db.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
try {
  console.log(`DB: ${dbPath}`);
  console.log(`Cutoff: end_date <= ${new Date(cutoff).toISOString()}`);
  const { keep, clear, changed } = apply
    ? applyClear(db, cutoff, KEEP_SLUG)
    : { ...planClear(db, cutoff, KEEP_SLUG), changed: 0 };
  console.log(`Kept: ${describeRow(keep)}, message ${keep.messageID}`);
  console.log(apply ? "Cleared:" : "Would clear:");
  for (const row of clear) {
    console.log(`  ${describeRow(row)}`);
  }
  if (apply) {
    console.log(`Cleared the message id of ${changed} ended tournament(s).`);
  } else {
    console.log(`Dry run: would clear the message id of ${clear.length} ended tournament(s).`);
    console.log("Run again with --apply to write.");
  }
} catch (e) {
  console.error(e instanceof ClearError ? e.message : e);
  process.exitCode = 1;
} finally {
  db.close();
}
