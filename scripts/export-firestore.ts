/**
 * One-off, READ-ONLY Firestore export: dumps collections to JSON (document IDs kept)
 * as a backup and as input for the SQLite import (scripts/import-firestore-export.ts).
 *
 *   npm run export:firestore              # dry run: prints the plan, no Firebase, no network
 *   npm run export:firestore -- --yes     # actually reads Firestore (costs reads)
 *
 * Options:
 *   --yes                 Required to read Firestore. Without it nothing is loaded or read.
 *   --tournaments=<name>  Tournament collection (default: $TOURNAMENT_COLLECTION_NAME, else "tournaments").
 *   --include-dev         Also export tournaments_dev.
 *   --also=a,b            Also export these collections (e.g. shucfixes,shucfixbans as a backup).
 *   --out=<dir>           Output root (default: data/firestore-export).
 *   --key=<file>          Service account key (default: firebasekey.json in the repo root).
 *
 * Output: <out>/<timestamp>/<collection>.json plus manifest.json, copied to
 * <out>/latest/. Build the bot's DB from it with `bun run import:firestore <out>/latest`.
 *
 * Runs under Node (firebase-admin is not officially supported on Bun), straight
 * from the .ts source via Node's built-in type stripping (Node >= 22.18), so this
 * file and the modules it imports must stick to erasable TypeScript syntax and
 * import local files with their .ts extension. It only calls
 * CollectionReference.get(); there are no write APIs in this file.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  CollectionExport,
  encodeMap,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  FirestoreTypes,
} from "./lib/firestoreCodec.ts";

const BOT_COLLECTIONS = ["joinableroles", "role_categories"];
const DEV_COLLECTION = "tournaments_dev";
const REPO_ROOT = resolve(import.meta.dirname, "..");

interface Options {
  yes: boolean;
  collections: string[];
  outRoot: string;
  keyFile: string;
}

const parseArgs = (argv: string[]): Options => {
  // A Map built from entries (rather than Map.set) keeps this file free of any
  // `.set(` call, which test/exportScript.test.ts treats as a write API.
  const flags = new Map<string, string | true>(
    argv.map((arg) => {
      const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
      if (!m) {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      return [m[1], m[2] ?? true];
    }),
  );
  const known = new Set(["yes", "tournaments", "include-dev", "also", "out", "key"]);
  for (const name of flags.keys()) {
    if (!known.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
  }
  const str = (name: string): string | undefined => {
    const v = flags.get(name);
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const tournaments = str("tournaments") ?? process.env.TOURNAMENT_COLLECTION_NAME ?? "tournaments";
  const collections = [...BOT_COLLECTIONS, tournaments];
  if (flags.has("include-dev")) {
    collections.push(DEV_COLLECTION);
  }
  for (const extra of (str("also") ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    collections.push(extra);
  }

  return {
    yes: flags.get("yes") === true,
    collections: [...new Set(collections)],
    outRoot: resolve(str("out") ?? join(REPO_ROOT, "data", "firestore-export")),
    keyFile: resolve(str("key") ?? join(REPO_ROOT, "firebasekey.json")),
  };
};

const printPlan = (opts: Options) => {
  console.log("Firestore export (read-only)");
  console.log(`  collections: ${opts.collections.join(", ")}`);
  console.log(`  key file:    ${opts.keyFile}`);
  console.log(`  output:      ${join(opts.outRoot, "<timestamp>")} and ${join(opts.outRoot, "latest")}`);
  console.log(
    `  read cost:   1 read per document (at least 1 per collection, so >= ${opts.collections.length} reads). ` +
      "Exact counts are only known after the run.",
  );
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  printPlan(opts);

  if (!opts.yes) {
    console.log("\nDry run: nothing was read. Re-run with --yes to read Firestore.");
    return;
  }
  if (!existsSync(opts.keyFile)) {
    throw new Error(`Key file not found: ${opts.keyFile}`);
  }

  // Loaded only after --yes, so the dry run never touches Firebase or the network.
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore, Timestamp, GeoPoint, DocumentReference } = await import("firebase-admin/firestore");
  const serviceAccount = JSON.parse(readFileSync(opts.keyFile, "utf8"));
  const app = initializeApp({ credential: cert(serviceAccount) }, "export");
  const db = getFirestore(app);
  const types: FirestoreTypes = { Timestamp, GeoPoint, DocumentReference };

  const exportedAt = new Date().toISOString();
  const dir = join(opts.outRoot, exportedAt.replace(/:/g, "-"));
  mkdirSync(dir, { recursive: true });

  const counts: Record<string, number> = {};
  let reads = 0;
  try {
    for (const name of opts.collections) {
      const snapshot = await db.collection(name).get();
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: encodeMap(doc.data(), types, `${name}/${doc.id}`),
      }));
      const file: CollectionExport = {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        collection: name,
        exportedAt,
        count: docs.length,
        docs,
      };
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(file, null, 2) + "\n");
      counts[name] = docs.length;
      reads += Math.max(1, docs.length);
      console.log(`  ${name}: ${docs.length} docs`);
    }
  } finally {
    await db.terminate(); // closes the client connection
  }

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt, counts }, null, 2) + "\n",
  );

  const latest = join(opts.outRoot, "latest");
  rmSync(latest, { recursive: true, force: true });
  mkdirSync(latest, { recursive: true });
  for (const f of readdirSync(dir)) {
    copyFileSync(join(dir, f), join(latest, f));
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nExported ${total} docs from ${opts.collections.length} collections (~${reads} reads).`);
  console.log(`  ${dir}`);
  console.log(`  ${latest}`);
  console.log(`\nBuild a SQLite DB from it: bun run import:firestore ${latest} --dry-run`);
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
