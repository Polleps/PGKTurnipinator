import type { Database } from "bun:sqlite";

/** A tournament row, as far as this one-off cares. */
export interface EndedRow {
  id: string;
  url: string;
  title: string;
  endDate: number;
  messageID: string;
}

export interface ClearPlan {
  /** Ended tournaments whose message id would be cleared. */
  clear: EndedRow[];
  /** The tournament kept on purpose (matched on its start.gg slug, `url`). */
  keep: EndedRow;
}

export class ClearError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClearError";
  }
}

const ENDED_WITH_MESSAGE = `
  SELECT id, url, title, end_date AS endDate, message_id AS messageID
  FROM tournaments
  WHERE end_date <= ? AND message_id IS NOT NULL
  ORDER BY end_date DESC, id`;

/**
 * Tournaments ended by `cutoff` (`end_date <= cutoff`, as everywhere in the bot) that still store
 * a message id, newest end first, split into the one to keep (its `url`, the start.gg slug, equals
 * `keepSlug` ignoring case, like upcomingBySlug) and the rest. Throws when the slug doesn't match
 * exactly one ended tournament with a message id: the maintainer kept that message on purpose.
 */
export const planClear = (db: Database, cutoff: number, keepSlug: string): ClearPlan => {
  const slug = keepSlug.trim().toLowerCase();
  const rows = db.query<EndedRow, [number]>(ENDED_WITH_MESSAGE).all(cutoff);
  const keep = rows.filter((r) => r.url.toLowerCase() === slug);
  if (keep.length !== 1) {
    const any = db.query<{ id: string }, [string]>("SELECT id FROM tournaments WHERE lower(url) = ?").all(slug);
    const why =
      any.length === 0
        ? "no tournament has that slug"
        : keep.length === 0
          ? `found ${any.length} tournament(s) with that slug (id ${any.map((r) => r.id).join(", ")}), ` +
            "but none has ended by the cutoff with a stored message id"
          : `${keep.length} ended tournaments with a message id share that slug (id ${keep.map((r) => r.id).join(", ")})`;
    throw new ClearError(`Cannot keep "${keepSlug}": ${why}. Nothing changed.`);
  }
  return { keep: keep[0]!, clear: rows.filter((r) => r !== keep[0]) };
};

/**
 * Clears (sets NULL) the message id of every ended tournament except the kept one, in one
 * IMMEDIATE transaction, re-planned inside it so a concurrent write can't slip in between.
 * Only rows still holding the message id that was planned are touched. Returns the plan and the
 * number of rows changed.
 */
export const applyClear = (db: Database, cutoff: number, keepSlug: string): ClearPlan & { changed: number } =>
  db
    .transaction(() => {
      const plan = planClear(db, cutoff, keepSlug);
      const update = db.prepare<unknown, [string, string]>(
        "UPDATE tournaments SET message_id = NULL WHERE id = ? AND message_id = ?",
      );
      let changed = 0;
      for (const row of plan.clear) {
        changed += update.run(row.id, row.messageID).changes;
      }
      if (changed !== plan.clear.length) {
        throw new ClearError(`Expected to change ${plan.clear.length} rows, changed ${changed}; rolled back.`);
      }
      return { ...plan, changed };
    })
    .immediate();
