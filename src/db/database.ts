import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
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
  if (!memory) {
    sqlite.run("PRAGMA journal_mode = WAL");
  }
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");

  const db = drizzle(sqlite, { schema }) as Db;
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
};
