import { createLogger } from "./utils/logger";
import { DEFAULT_DATABASE_PATH, isMemoryPath, openDatabase, type Db } from "./db/database";
import { RoleRepository } from "./db/RoleRepository";
import { TournamentRepository } from "./db/TournamentRepository";

const log = createLogger("Store");

export interface StoreOptions {
  /** A file path or ":memory:". Defaults to DATABASE_PATH, else data/turnipinator.db. */
  path?: string;
  /** Create the DB when missing (tests and scripts; the bot refuses to start instead). */
  create?: boolean;
}

/**
 * The bot's data: one SQLite DB (bun:sqlite + Drizzle), opened once at startup. Queries
 * are synchronous, so there is nothing to cache or reload.
 */
export class Store {
  private opened?: { db: Db; path: string; tournaments: TournamentRepository; roles: RoleRepository };

  /** Opens the DB and applies pending migrations. Throws if the file doesn't exist (unless `create`). */
  public init({ path = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH, create = false }: StoreOptions = {}): void {
    if (this.opened) {
      throw new Error(`Store is already open (${this.opened.path}).`);
    }
    const db = openDatabase({ path, create });
    this.opened = { db, path, tournaments: new TournamentRepository(db), roles: new RoleRepository(db) };
    log(
      `Data source: SQLite ${isMemoryPath(path) ? "(in memory)" : path}; ` +
        `${this.opened.tournaments.count()} tournaments, ${this.opened.roles.roles().length} joinable roles.`,
    );
  }

  public get tournaments(): TournamentRepository {
    return this.require().tournaments;
  }

  public get roles(): RoleRepository {
    return this.require().roles;
  }

  public get db(): Db {
    return this.require().db;
  }

  /** Closes the DB for real (finalizing Drizzle's statements), so its WAL is folded in and the file unlocked. */
  public close(): void {
    this.opened?.db.$client.close(true);
    this.opened = undefined;
  }

  private require() {
    if (!this.opened) {
      throw new Error("Store is not open: call store.init() first.");
    }
    return this.opened;
  }
}

export const store = new Store();
