import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as schema from "./schema";

export type Db = BunSQLiteDatabase<typeof schema> & { $client: Database };

export const MIGRATIONS_FOLDER = resolve(import.meta.dir, "migrations");

/** Where the bot's DB lives unless DATABASE_PATH says otherwise (gitignored). */
export const DEFAULT_DATABASE_PATH = resolve(import.meta.dir, "..", "..", "data", "turnipinator.db");

export const isMemoryPath = (path: string): boolean => path === ":memory:";

export class DatabaseMissingError extends Error {
  constructor(public readonly path: string) {
    super(
      `No SQLite database at ${path}. Build one from a Firestore export with ` +
        "`bun run import:firestore <export-dir> --db=<path>`, or point DATABASE_PATH at an existing one.",
    );
    this.name = "DatabaseMissingError";
  }
}

export interface OpenOptions {
  /** A file path, or ":memory:". */
  path: string;
  /**
   * Create the file when it doesn't exist. The bot never does: a wrong DATABASE_PATH must
   * fail loudly instead of starting on an empty DB. The import script and tests do.
   */
  create?: boolean;
}

/**
 * Opens the DB with WAL, foreign keys and a busy timeout, and applies pending migrations.
 */
export const openDatabase = ({ path, create = false }: OpenOptions): Db => {
  const memory = isMemoryPath(path);
  const file = memory ? path : resolve(path);
  if (!memory && !existsSync(file)) {
    if (!create) {
      throw new DatabaseMissingError(file);
    }
    mkdirSync(dirname(file), { recursive: true });
  }

  const sqlite = new Database(file, { create: create || memory, readwrite: true, strict: true });
  // First, so everything below waits for another process instead of failing with SQLITE_BUSY.
  sqlite.run(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  if (!memory) {
    // Switching a fresh file to WAL needs an exclusive lock, and SQLite reports BUSY for it
    // without calling the busy handler; retry when another process is doing the same.
    retryWhileBusy(() => sqlite.run("PRAGMA journal_mode = WAL"));
  }
  sqlite.run("PRAGMA foreign_keys = ON");

  runMigrations(sqlite);
  return drizzle(sqlite, { schema }) as Db;
};

export const BUSY_TIMEOUT_MS = 5000;

const isBusy = (e: unknown) =>
  e instanceof Error && /database is locked|SQLITE_BUSY/i.test(`${e.message} ${(e as { code?: string }).code ?? ""}`);

const retryWhileBusy = (fn: () => void, timeoutMs: number = BUSY_TIMEOUT_MS): void => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      fn();
      return;
    } catch (e) {
      if (!isBusy(e) || Date.now() >= deadline) {
        throw e;
      }
      Bun.sleepSync(10 + Math.random() * 40);
    }
  }
};

const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Applies pending drizzle-kit migrations, like drizzle's own migrator and with its bookkeeping
 * table, but safe when two processes start together: the "which migrations are applied" check
 * runs inside the same BEGIN IMMEDIATE transaction as the migrations (drizzle reads it before
 * its BEGIN), so the second process waits for the first and then finds nothing to do.
 */
export const runMigrations = (sqlite: Database, migrationsFolder: string = MIGRATIONS_FOLDER): number => {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.run(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
  sqlite.run("BEGIN IMMEDIATE");
  try {
    const last = sqlite
      .query(`SELECT created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`)
      .get() as { created_at: number } | null;
    let applied = 0;
    for (const migration of migrations) {
      if (last && Number(last.created_at) >= migration.folderMillis) {
        continue;
      }
      for (const statement of migration.sql) {
        if (statement.trim() !== "") {
          sqlite.run(statement);
        }
      }
      sqlite
        .query(`INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`)
        .run(migration.hash, migration.folderMillis);
      applied++;
    }
    sqlite.run("COMMIT");
    return applied;
  } catch (e) {
    sqlite.run("ROLLBACK");
    throw e;
  }
};
