import { and, asc, count, desc, eq, gt, gte, lt, sql, type SQL } from "drizzle-orm";
import type { Db } from "./database";
import type { NormalizedTournament } from "./normalizeTournament";
import { tournaments, type Tournament } from "./schema";

export type UpsertResult = "inserted" | "updated";

/** Filters shared by the list queries. Dates are epoch ms. */
export interface TournamentFilter {
  /** Only tournaments that haven't ended before this: `end_date >= from`. */
  from?: number;
  /** Only tournaments that start before this: `start_date < to`. */
  to?: number;
  online?: boolean;
}

/** Keyset position: the (start_date, id) of the last item of the previous page. */
export interface TournamentCursor {
  startDate: number;
  id: string;
}

export interface TournamentPage {
  items: Tournament[];
  /** Position after the last item, or null when there is nothing after it. */
  next: TournamentCursor | null;
}

const filterConditions = ({ from, to, online }: TournamentFilter): SQL[] => [
  ...(from !== undefined ? [gte(tournaments.endDate, from)] : []),
  ...(to !== undefined ? [lt(tournaments.startDate, to)] : []),
  ...(online !== undefined ? [eq(tournaments.isOnline, online)] : []),
];

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
  private writes = 0;

  constructor(private readonly db: Db) {}

  /**
   * Changes whenever this repository adds, changes or removes tournament details, so
   * in-memory caches built from it (the iCal feed) can tell they are stale.
   */
  public get revision(): number {
    return this.writes;
  }

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

  /**
   * One page of tournaments matching `filter`, ordered by (start_date, id) and starting after
   * `after`. Keyset pagination: rows inserted or removed elsewhere never shift a page, and the
   * query walks the `tournaments_start_id` index.
   */
  public page(filter: TournamentFilter, limit: number, after?: TournamentCursor): TournamentPage {
    const conditions = filterConditions(filter);
    if (after) {
      conditions.push(sql`(${tournaments.startDate}, ${tournaments.id}) > (${after.startDate}, ${after.id})`);
    }
    const rows = this.db
      .select()
      .from(tournaments)
      .where(and(...conditions))
      .orderBy(asc(tournaments.startDate), asc(tournaments.id))
      .limit(limit + 1)
      .all();
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, next: rows.length > limit && last ? { startDate: last.startDate, id: last.id } : null };
  }

  /** Tournaments with this start.gg slug (a reused slug can match several editions), newest first. */
  public byUrl(url: string, filter: TournamentFilter, limit: number): Tournament[] {
    return this.db
      .select()
      .from(tournaments)
      .where(and(eq(tournaments.url, url), ...filterConditions(filter)))
      .orderBy(desc(tournaments.startDate), desc(tournaments.id))
      .limit(limit)
      .all();
  }

  /**
   * Up to `limit` tournaments that haven't ended at `now`, soonest first, whose start.gg slug or
   * title contains `search` (case-insensitive; empty matches all). For the /delete-tournament
   * autocomplete.
   */
  public searchUpcoming(search: string, now: number, limit: number): Tournament[] {
    return this.searchUpcomingQuery(search, now, limit).all();
  }

  /**
   * The query behind searchUpcoming (exposed so tests can check its plan). It range-scans the
   * `tournaments_end` index and sorts the few upcoming rows; the unary `+` keeps SQLite from
   * walking `tournaments_start_id` from the oldest tournament instead (to skip the sort).
   */
  public searchUpcomingQuery(search: string, now: number, limit: number) {
    const needle = search.trim().toLowerCase();
    const conditions: SQL[] = [gt(tournaments.endDate, now)];
    if (needle !== "") {
      conditions.push(
        sql`(instr(lower(${tournaments.url}), ${needle}) > 0 OR instr(lower(${tournaments.title}), ${needle}) > 0)`,
      );
    }
    return this.db
      .select()
      .from(tournaments)
      .where(and(...conditions))
      .orderBy(sql`+${tournaments.startDate}`, sql`+${tournaments.id}`)
      .limit(limit);
  }

  /** Tournaments that haven't ended at `now` with exactly this slug (case-insensitive), newest first. */
  public upcomingBySlug(slug: string, now: number): Tournament[] {
    return this.db
      .select()
      .from(tournaments)
      .where(and(gt(tournaments.endDate, now), sql`lower(${tournaments.url}) = ${slug.trim().toLowerCase()}`))
      .orderBy(desc(tournaments.startDate), desc(tournaments.id))
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
    const result = this.db.transaction((tx): UpsertResult => {
      const exists = tx.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, id)).get();
      if (exists) {
        tx.update(tournaments).set(rest).where(eq(tournaments.id, id)).run();
        return "updated";
      }
      tx.insert(tournaments).values(t).run();
      return "inserted";
    });
    this.writes++;
    return result;
  }

  /** Inserts many rows in one transaction (the import). Fails as a whole on any constraint violation. */
  public insertMany(rows: NormalizedTournament[]): void {
    this.db.transaction((tx) => {
      for (const row of rows) {
        tx.insert(tournaments).values(row).run();
      }
    });
    this.writes++;
  }

  /** Removes a tournament. Returns false if there is no such row. */
  public delete(id: string): boolean {
    const deleted = this.db.delete(tournaments).where(eq(tournaments.id, id)).returning({ id: tournaments.id }).all();
    this.writes++;
    return deleted.length > 0;
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
