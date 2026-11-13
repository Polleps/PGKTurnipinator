import { asc, count, eq, gt } from "drizzle-orm";
import type { Db } from "./database";
import type { NormalizedTournament } from "./normalizeTournament";
import { tournaments, type Tournament } from "./schema";

export type UpsertResult = "inserted" | "updated";

export interface TournamentStatus {
  participants: number | null;
  /** Epoch ms. */
  registrationClosesAt: number | null;
}

/**
 * Synchronous access to the `tournaments` table. Every list is ordered by (start_date, id),
 * which the `tournaments_start_id` index serves; paginated queries build on the same order.
 */
export class TournamentRepository {
  constructor(private readonly db: Db) {}

  /** Every tournament, oldest first. */
  public all(): Tournament[] {
    return this.db.select().from(tournaments).orderBy(asc(tournaments.startDate), asc(tournaments.id)).all();
  }

  /** Tournaments that haven't ended at `now` (epoch ms), soonest first. */
  public upcoming(now: number = Date.now()): Tournament[] {
    return this.db
      .select()
      .from(tournaments)
      .where(gt(tournaments.endDate, now))
      .orderBy(asc(tournaments.startDate), asc(tournaments.id))
      .all();
  }

  public getById(id: string): Tournament | undefined {
    return this.db.select().from(tournaments).where(eq(tournaments.id, id)).get();
  }

  public count(): number {
    return this.db.select({ n: count() }).from(tournaments).get()?.n ?? 0;
  }

  /**
   * Inserts a new tournament, or updates the row with the same id. A new id is always an
   * insert, even when its url matches an older row (a reused start.gg slug for a new edition).
   * The start.gg status fields are kept: only the refresh writes them.
   */
  public upsert(t: NormalizedTournament): UpsertResult {
    const { id, ...rest } = t;
    return this.db.transaction((tx) => {
      const exists = tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id)).get();
      if (exists) {
        tx.update(tournaments).set(rest).where(eq(tournaments.id, id)).run();
        return "updated";
      }
      tx.insert(tournaments).values(t).run();
      return "inserted";
    });
  }

  /** Inserts many rows in one transaction (the import). Fails as a whole on any constraint violation. */
  public insertMany(rows: NormalizedTournament[]): void {
    this.db.transaction((tx) => {
      for (const row of rows) {
        tx.insert(tournaments).values(row).run();
      }
    });
  }

  /** Stores the start.gg status of a tournament. Returns false if there is no such row. */
  public setStatus(id: string, status: TournamentStatus): boolean {
    const updated = this.db
      .update(tournaments)
      .set({ participants: status.participants, registrationClosesAt: status.registrationClosesAt })
      .where(eq(tournaments.id, id))
      .returning({ id: tournaments.id })
      .all();
    return updated.length > 0;
  }

  /** For tests and diagnostics: the raw SQLite integrity check. */
  public integrityCheck(): string {
    const row = this.db.$client.query("PRAGMA integrity_check").get() as { integrity_check: string } | null;
    return row?.integrity_check ?? "no result";
  }
}
