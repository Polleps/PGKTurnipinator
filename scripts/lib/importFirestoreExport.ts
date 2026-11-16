import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { openDatabase } from "../../src/db/database";
import { normalizeTournament, type NormalizedTournament } from "../../src/db/normalizeTournament";
import { RoleRepository } from "../../src/db/RoleRepository";
import type { JoinableRole, RoleCategory } from "../../src/db/schema";
import { TournamentRepository } from "../../src/db/TournamentRepository";
import { decodeMap, isCollectionExport, type EncodedMap, type ExportedDoc } from "./firestoreCodec";

/**
 * Builds a fresh SQLite DB from a Firestore JSON export (scripts/export-firestore.ts).
 *
 * Tournaments go through normalizeTournament (defaults, or quarantine for docs missing an
 * id/url/title/startDate). Of several docs with the same start.gg id, the one with the latest
 * startDate is kept (tie: the first in export order); the others are quarantined. Docs that
 * share a url but not an id are all imported (a reused slug is a new edition).
 *
 * Everything is inserted into an in-memory DB in one transaction, so a dry run hits the
 * same constraints as a real import. Counts are verified against the export and its
 * manifest. Collections the bot no longer uses (botadmins, shucfixes, ...) are skipped.
 */

export const IMPORTED_COLLECTIONS = ["role_categories", "joinableroles"] as const;

export interface ImportOptions {
  exportDir: string;
  /** Target DB file. Ignored by a dry run. */
  dbPath: string;
  dryRun?: boolean;
  /** Replace an existing DB file. Without it the import refuses to overwrite. */
  force?: boolean;
  /** Name of the tournament collection in the export. */
  tournamentCollection?: string;
}

export interface CollectionReport {
  exported: number;
  imported: number;
  quarantined: number;
  /** Per field: how many imported docs got a default or a repaired value. */
  defaulted: Record<string, number>;
  /** Keys not in the schema, dropped: how many docs had each. */
  droppedKeys: Record<string, number>;
  /** Per reason: how many docs were quarantined. */
  quarantineReasons: Record<string, number>;
}

export interface QuarantinedDoc {
  collection: string;
  docId: string;
  reason: string;
  /** The doc as exported. */
  doc: EncodedMap;
}

export interface ImportReport {
  exportDir: string;
  exportedAt: string | null;
  db: string;
  dryRun: boolean;
  importedAt: string;
  collections: Record<string, CollectionReport>;
  skippedCollections: string[];
  /** Every imported tournament that got a default, with the fields. */
  tournamentDefaults: Array<{ docId: string; id: string; fields: string[] }>;
}

export interface ImportResult {
  report: ImportReport;
  quarantine: QuarantinedDoc[];
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

interface Manifest {
  exportedAt?: string;
  counts?: Record<string, number>;
}

const tally = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const emptyReport = (exported: number): CollectionReport => ({
  exported,
  imported: 0,
  quarantined: 0,
  defaulted: {},
  droppedKeys: {},
  quarantineReasons: {},
});

const readCollection = (dir: string, collection: string): ExportedDoc[] => {
  const file = join(dir, `${collection}.json`);
  if (!existsSync(file)) {
    throw new ImportError(`The export has no ${collection}.json (${file}).`);
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isCollectionExport(parsed) || parsed.collection !== collection) {
    throw new ImportError(`${file} is not a valid export of collection "${collection}".`);
  }
  return parsed.docs;
};

const readManifest = (dir: string): Manifest | undefined => {
  const file = join(dir, "manifest.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Manifest) : undefined;
};

const nonBlank = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

interface Prepared {
  report: ImportReport;
  quarantine: QuarantinedDoc[];
  tournaments: NormalizedTournament[];
  categories: RoleCategory[];
  roles: JoinableRole[];
}

/** Reads and normalizes the export. Pure: touches no DB. */
export const prepareImport = ({
  exportDir,
  dbPath,
  dryRun = false,
  tournamentCollection = "tournaments",
}: ImportOptions): Prepared => {
  const dir = resolve(exportDir);
  if (!existsSync(dir)) {
    throw new ImportError(`Export directory not found: ${dir}`);
  }
  const manifest = readManifest(dir);
  const quarantine: QuarantinedDoc[] = [];
  const collections: Record<string, CollectionReport> = {};

  // --- tournaments
  const tournamentDocs = readCollection(dir, tournamentCollection);
  const tr = (collections[tournamentCollection] = emptyReport(tournamentDocs.length));
  const candidates: Array<{
    index: number;
    docId: string;
    row: NormalizedTournament;
    fields: string[];
    dropped: string[];
  }> = [];
  tournamentDocs.forEach((doc, index) => {
    const result = normalizeTournament(decodeMap(doc.data));
    if (!result.ok) {
      quarantine.push({ collection: tournamentCollection, docId: doc.id, reason: result.reason, doc: doc.data });
      tally(tr.quarantineReasons, result.reason);
      return;
    }
    candidates.push({ index, docId: doc.id, row: result.row, fields: result.defaulted, dropped: result.droppedKeys });
  });

  const byId = new Map<string, typeof candidates>();
  for (const c of candidates) {
    byId.set(c.row.id, [...(byId.get(c.row.id) ?? []), c]);
  }
  const kept: typeof candidates = [];
  for (const group of byId.values()) {
    // Latest startDate wins; on a tie the first in export order (stable sort).
    const [winner, ...losers] = [...group].sort((a, b) => b.row.startDate - a.row.startDate || a.index - b.index);
    kept.push(winner);
    for (const loser of losers) {
      const reason = "duplicate id";
      quarantine.push({
        collection: tournamentCollection,
        docId: loser.docId,
        reason: `${reason} ${loser.row.id} (kept doc ${winner.docId})`,
        doc: tournamentDocs[loser.index].data,
      });
      tally(tr.quarantineReasons, reason);
    }
  }
  kept.sort((a, b) => a.index - b.index);
  const tournamentDefaults: ImportReport["tournamentDefaults"] = [];
  for (const c of kept) {
    c.fields.forEach((f) => tally(tr.defaulted, f));
    c.dropped.forEach((k) => tally(tr.droppedKeys, k));
    if (c.fields.length > 0) {
      tournamentDefaults.push({ docId: c.docId, id: c.row.id, fields: c.fields });
    }
  }

  // --- role categories
  const categoryDocs = readCollection(dir, "role_categories");
  const cr = (collections.role_categories = emptyReport(categoryDocs.length));
  const categories: RoleCategory[] = [];
  for (const doc of categoryDocs) {
    const data = decodeMap(doc.data);
    const reject = (reason: string) => {
      quarantine.push({ collection: "role_categories", docId: doc.id, reason, doc: doc.data });
      tally(cr.quarantineReasons, reason);
    };
    if (!nonBlank(data.name)) {
      reject("missing name");
      continue;
    }
    if (categories.some((c) => c.name === data.name)) {
      reject("duplicate name");
      continue;
    }
    if (typeof data.description !== "string") {
      tally(cr.defaulted, "description");
    }
    Object.keys(data)
      .filter((k) => k !== "name" && k !== "description")
      .forEach((k) => tally(cr.droppedKeys, k));
    categories.push({ name: data.name, description: typeof data.description === "string" ? data.description : "" });
  }

  // --- joinable roles
  const roleDocs = readCollection(dir, "joinableroles");
  const rr = (collections.joinableroles = emptyReport(roleDocs.length));
  const roles: JoinableRole[] = [];
  for (const doc of roleDocs) {
    const data = decodeMap(doc.data);
    const reject = (reason: string) => {
      quarantine.push({ collection: "joinableroles", docId: doc.id, reason, doc: doc.data });
      tally(rr.quarantineReasons, reason);
    };
    const missing = (["ID", "name", "category"] as const).filter((k) => !nonBlank(data[k]));
    if (missing.length > 0) {
      reject(`missing ${missing.join(", ")}`);
      continue;
    }
    const role = { id: data.ID as string, name: data.name as string, category: data.category as string };
    if (!categories.some((c) => c.name === role.category)) {
      reject("unknown category");
      continue;
    }
    if (roles.some((r) => r.id === role.id || r.name === role.name)) {
      reject("duplicate ID or name");
      continue;
    }
    if (typeof data.description !== "string") {
      tally(rr.defaulted, "description");
    }
    // categoryID (on a few docs) is redundant with category.
    Object.keys(data)
      .filter((k) => !["ID", "name", "category", "description"].includes(k))
      .forEach((k) => tally(rr.droppedKeys, k));
    roles.push({ ...role, description: typeof data.description === "string" ? data.description : "" });
  }

  tr.imported = kept.length;
  tr.quarantined = tr.exported - kept.length;
  cr.imported = categories.length;
  cr.quarantined = cr.exported - categories.length;
  rr.imported = roles.length;
  rr.quarantined = rr.exported - roles.length;

  const handled = new Set<string>([tournamentCollection, ...IMPORTED_COLLECTIONS]);
  const skippedCollections = Object.keys(manifest?.counts ?? {}).filter((c) => !handled.has(c));

  // Every exported doc is either imported or quarantined, and the files match the manifest.
  for (const [name, c] of Object.entries(collections)) {
    const inQuarantine = quarantine.filter((q) => q.collection === name).length;
    if (c.imported + inQuarantine !== c.exported || c.quarantined !== inQuarantine) {
      throw new ImportError(`${name}: imported ${c.imported} + quarantined ${inQuarantine} != exported ${c.exported}`);
    }
    const listed = manifest?.counts?.[name];
    if (listed !== undefined && listed !== c.exported) {
      throw new ImportError(`${name}: manifest.json lists ${listed} docs, ${name}.json has ${c.exported}`);
    }
  }

  return {
    report: {
      exportDir: dir,
      exportedAt: manifest?.exportedAt ?? null,
      db: dryRun ? ":memory:" : resolve(dbPath),
      dryRun,
      importedAt: new Date().toISOString(),
      collections,
      skippedCollections,
      tournamentDefaults,
    },
    quarantine,
    tournaments: kept.map((c) => c.row),
    categories,
    roles,
  };
};

const sidecars = (file: string) => [file, `${file}-wal`, `${file}-shm`, `${file}-journal`];

const STOP_THE_BOT = "Stop the bot (and anything else using the DB) first, then run the import again.";

/**
 * Refuses to replace a DB that is in use: --force would otherwise swap the file under a
 * running bot and lose whatever is still in its WAL. A non-empty -wal file means
 * un-checkpointed writes (an open connection, or a crash); an exclusive lock fails while any
 * other connection has the DB open, because WAL readers hold a shared lock on the file.
 */
export const assertNotInUse = (target: string, busyTimeoutMs = 1000): void => {
  const wal = `${target}-wal`;
  if (existsSync(wal) && statSync(wal).size > 0) {
    throw new ImportError(
      `${wal} holds writes that aren't in ${target} yet. ${STOP_THE_BOT} ` +
        "(If nothing is running, open the DB once, e.g. by starting and stopping the bot, so SQLite folds them in.)",
    );
  }
  let db: Database | undefined;
  try {
    db = new Database(target, { readwrite: true, create: false });
    db.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    db.run("PRAGMA locking_mode = EXCLUSIVE");
    db.run("BEGIN EXCLUSIVE");
    db.run("ROLLBACK");
  } catch (e) {
    throw new ImportError(`${target} is in use (${(e as Error).message}). ${STOP_THE_BOT}`);
  } finally {
    db?.close();
  }
};

/**
 * Runs the import. Everything is inserted into an in-memory DB first (one transaction) and
 * checked; a real import then writes it out with VACUUM INTO `<db>.importing` and renames
 * that into place, so a failed import never leaves a half-filled DB behind.
 */
export const runImport = (options: ImportOptions): ImportResult => {
  const prepared = prepareImport(options);
  const { report } = prepared;
  const target = report.db;

  if (!options.dryRun && existsSync(target)) {
    if (!options.force) {
      throw new ImportError(`${target} already exists. Pass --force to replace it.`);
    }
    // Fail before the work, and check again right before the swap.
    assertNotInUse(target);
  }

  const db = openDatabase({ path: ":memory:" });
  try {
    const tournaments = new TournamentRepository(db);
    const roles = new RoleRepository(db);
    db.transaction(() => {
      prepared.categories.forEach((c) => roles.addCategory(c));
      prepared.roles.forEach((r) => roles.addRole(r));
      tournaments.insertMany(prepared.tournaments);
    });

    const counts: Record<string, number> = {
      [options.tournamentCollection ?? "tournaments"]: tournaments.count(),
      role_categories: roles.categories().length,
      joinableroles: roles.roles().length,
    };
    for (const [name, n] of Object.entries(counts)) {
      if (n !== report.collections[name].imported) {
        throw new ImportError(`${name}: the DB has ${n} rows, expected ${report.collections[name].imported}`);
      }
    }
    const integrity = tournaments.integrityCheck();
    if (integrity !== "ok") {
      throw new ImportError(`integrity_check: ${integrity}`);
    }

    if (!options.dryRun) {
      const work = `${target}.importing`;
      sidecars(work).forEach((f) => rmSync(f, { force: true }));
      mkdirSync(dirname(target), { recursive: true });
      db.$client.query("VACUUM INTO ?").run(work);
      if (existsSync(target)) {
        assertNotInUse(target);
        sidecars(target).forEach((f) => rmSync(f, { force: true }));
      }
      renameSync(work, target);
    }
  } finally {
    db.$client.close();
  }

  return { report, quarantine: prepared.quarantine };
};

/** Writes import-report.json and quarantine.json into `dir`. */
export const writeReports = (dir: string, result: ImportResult): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "import-report.json"), JSON.stringify(result.report, null, 2) + "\n");
  writeFileSync(join(dir, "quarantine.json"), JSON.stringify(result.quarantine, null, 2) + "\n");
};
