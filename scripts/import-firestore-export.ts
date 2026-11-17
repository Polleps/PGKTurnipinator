/**
 * Builds the bot's SQLite DB from a Firestore JSON export (scripts/export-firestore.ts).
 * Reads the export only; never touches Firestore or the network.
 *
 *   bun run import:firestore <export-dir> --dry-run          # import into :memory:, write the reports
 *   bun run import:firestore <export-dir>                    # write the DB (refuses if it exists)
 *   bun run import:firestore <export-dir> --db=<file> --force
 *
 * Options:
 *   --db=<file>            Target DB (default: $DATABASE_PATH, else data/turnipinator.db).
 *   --dry-run              Import into an in-memory DB: all checks run, no file is written.
 *   --force                Replace an existing DB file.
 *   --report-dir=<dir>     Where import-report.json and quarantine.json go
 *                          (default: data/import-reports/<timestamp>[-dry-run]/, gitignored).
 *   --tournaments=<name>   Tournament collection in the export (default: tournaments).
 *
 * Exits non-zero, without writing a DB, when any count doesn't match the export.
 */
import { join, relative, resolve } from "path";
import { DEFAULT_DATABASE_PATH } from "../src/db/database";
import { ImportError, runImport, writeReports } from "./lib/importFirestoreExport";

const ROOT = resolve(import.meta.dir, "..");

const usage = (message?: string): never => {
  if (message) {
    console.error(message);
  }
  console.error(
    "Usage: bun run import:firestore <export-dir> [--dry-run] [--force] [--db=<file>] [--report-dir=<dir>] [--tournaments=<name>]",
  );
  process.exit(2);
};

const parseArgs = (argv: string[]) => {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (m) {
      flags.set(m[1], m[2] ?? true);
    } else {
      positional.push(arg);
    }
  }
  const known = new Set(["db", "dry-run", "force", "report-dir", "tournaments"]);
  for (const name of flags.keys()) {
    if (!known.has(name)) {
      usage(`Unknown option --${name}`);
    }
  }
  if (positional.length !== 1) {
    usage();
  }
  const str = (name: string) => {
    const v = flags.get(name);
    if (v === true) {
      usage(`--${name} needs a value`);
    }
    return v as string | undefined;
  };
  return {
    exportDir: positional[0],
    dbPath: str("db") ?? (process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH),
    dryRun: flags.get("dry-run") === true,
    force: flags.get("force") === true,
    reportDir: str("report-dir"),
    tournamentCollection: str("tournaments") ?? "tournaments",
  };
};

const main = () => {
  const opts = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportDir = resolve(
    opts.reportDir ?? join(ROOT, "data", "import-reports", `${stamp}${opts.dryRun ? "-dry-run" : ""}`),
  );

  console.log(
    `${opts.dryRun ? "Dry run: importing into :memory:" : `Importing into ${opts.dbPath}`} from ${opts.exportDir}`,
  );
  const result = runImport(opts);
  writeReports(reportDir, result);

  for (const [name, c] of Object.entries(result.report.collections)) {
    console.log(`\n${name}: exported ${c.exported}, imported ${c.imported}, quarantined ${c.quarantined}`);
    const reasons = Object.entries(c.quarantineReasons);
    if (reasons.length > 0) {
      console.log(`  quarantined: ${reasons.map(([r, n]) => `${r} ${n}`).join(", ")}`);
    }
    const defaults = Object.entries(c.defaulted).sort((a, b) => b[1] - a[1]);
    if (defaults.length > 0) {
      console.log(`  defaulted: ${defaults.map(([f, n]) => `${f} ${n}`).join(", ")}`);
    }
    const dropped = Object.entries(c.droppedKeys);
    if (dropped.length > 0) {
      console.log(`  dropped keys: ${dropped.map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
  }
  if (result.report.skippedCollections.length > 0) {
    console.log(`\nNot imported (unused by the bot): ${result.report.skippedCollections.join(", ")}`);
  }
  console.log(`\nReports: ${relative(process.cwd(), reportDir) || "."}/{import-report.json,quarantine.json}`);
  if (!opts.dryRun) {
    console.log(`DB written: ${result.report.db}`);
  }
};

try {
  main();
} catch (e) {
  console.error(e instanceof ImportError ? `Import failed: ${e.message}` : e);
  process.exit(1);
}
