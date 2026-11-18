/**
 * One-off: forgets the stored agenda message id of every ended tournament (end_date <= now)
 * except `borderline-smash-71`, whose message was kept on purpose to test the daily cleanup.
 * The other messages were already deleted from Discord by hand. Never contacts Discord and never
 * deletes rows: it only sets message_id to NULL.
 *
 *   bun run clear:ended-message-ids                 # dry run (.env.dev)
 *   bun run clear:ended-message-ids --apply
 *   NODE_ENV=production bun run clear:ended-message-ids [--apply]
 *
 * Options:
 *   --db=<file>   DB file (default: $DATABASE_PATH, else data/turnipinator.db).
 *   --apply       Write the change (one transaction). Without it nothing is written.
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
  console.error(`${message}\nUsage: bun run clear:ended-message-ids [--apply] [--db=<file>]`);
  process.exit(2);
};

let apply = false;
let dbArg: string | undefined;
for (const arg of process.argv.slice(2)) {
  if (arg === "--apply") {
    apply = true;
  } else if (arg.startsWith("--db=") && arg.length > "--db=".length) {
    dbArg = arg.slice("--db=".length);
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
const now = Date.now();
try {
  console.log(`DB: ${dbPath}`);
  if (apply) {
    const { keep, changed } = applyClear(db, now, KEEP_SLUG);
    console.log(`Kept: ${describeRow(keep)}, message ${keep.messageID}`);
    console.log(`Cleared the message id of ${changed} ended tournament(s).`);
  } else {
    const { keep, clear } = planClear(db, now, KEEP_SLUG);
    console.log(`Kept: ${describeRow(keep)}, message ${keep.messageID}`);
    console.log(`Dry run: would clear the message id of ${clear.length} ended tournament(s).`);
    console.log("Run again with --apply to write.");
  }
} catch (e) {
  console.error(e instanceof ClearError ? e.message : e);
  process.exitCode = 1;
} finally {
  db.close();
}
