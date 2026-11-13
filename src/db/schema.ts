import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The SQLite schema (bun:sqlite + Drizzle). Migrations in ./migrations are generated
 * from this file with `bun run db:generate`.
 *
 * The tournament table describes the shape the app writes today. Older documents are
 * repaired to fit it at import (see normalizeTournament.ts) or quarantined; the schema is
 * never loosened to fit them. A column is nullable only when the current flow itself
 * leaves the value out.
 */

/** One event of a tournament. `cap` is the entrant cap as typed in the form ("" = none). */
export interface TournamentEvent {
  name: string;
  cap: string;
}

/** One prize/entry fee line of a tournament. */
export interface TournamentPrice {
  name: string;
  amount: number;
}

const bool = (column: string) => sql.raw(`"${column}" IN (0, 1)`);

export const tournaments = sqliteTable(
  "tournaments",
  {
    /** start.gg tournament id. This is what makes a tournament unique. */
    id: text("id").primaryKey(),
    /** start.gg slug. Not unique: organisers reuse a slug for a new edition (new id). */
    url: text("url").notNull(),
    title: text("title").notNull(),
    image: text("image").notNull(),
    description: text("description").notNull(),
    /** "" for online tournaments; online status comes from isOnline. */
    location: text("location").notNull(),
    city: text("city").notNull(),
    /** Google Maps place id, "" when unknown. */
    locationID: text("location_id").notNull(),
    /** Epoch ms. */
    startDate: integer("start_date").notNull(),
    /** Epoch ms, never before startDate. */
    endDate: integer("end_date").notNull(),
    type: text("type", { enum: ["smashgg", "other"] }).notNull(),
    isOnline: integer("is_online", { mode: "boolean" }).notNull(),
    nocap: integer("nocap", { mode: "boolean" }).notNull(),
    pr: integer("pr", { mode: "boolean" }).notNull().default(false),
    events: text("events", { mode: "json" }).$type<TournamentEvent[]>().notNull(),
    prices: text("prices", { mode: "json" }).$type<TournamentPrice[]>().notNull(),
    /** Set together with streamStartDate, or both NULL (no stream). */
    streamURL: text("stream_url"),
    /** Epoch ms. Set together with streamURL, or both NULL. */
    streamStartDate: integer("stream_start_date"),
    /** The agenda embed. NULL when the tournament was saved without posting. */
    messageID: text("message_id"),
    /** The Discord scheduled event for the stream. NULL when none was created. */
    guildEventID: text("guild_event_id"),
    /** From the start.gg status refresh. NULL until it has run for this tournament. */
    participants: integer("participants"),
    /** Epoch ms, from the start.gg status refresh. NULL until it has run, or when start.gg has none. */
    registrationClosesAt: integer("registration_closes_at"),
  },
  (t) => [
    index("tournaments_start_id").on(t.startDate, t.id),
    index("tournaments_url").on(t.url, t.startDate),
    check("tournaments_end_after_start", sql`${t.endDate} >= ${t.startDate}`),
    check("tournaments_type", sql`${t.type} IN ('smashgg', 'other')`),
    check("tournaments_is_online_bool", bool("is_online")),
    check("tournaments_nocap_bool", bool("nocap")),
    check("tournaments_pr_bool", bool("pr")),
    check("tournaments_events_array", sql`json_type(${t.events}) = 'array'`),
    check("tournaments_prices_array", sql`json_type(${t.prices}) = 'array'`),
    check(
      "tournaments_stream_pair",
      sql`(${t.streamURL} IS NULL) = (${t.streamStartDate} IS NULL)`,
    ),
  ],
);

export const roleCategories = sqliteTable("role_categories", {
  name: text("name").primaryKey(),
  description: text("description").notNull(),
});

export const joinableRoles = sqliteTable("joinable_roles", {
  /** Discord role id. */
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category")
    .notNull()
    .references(() => roleCategories.name, { onUpdate: "cascade", onDelete: "restrict" }),
  description: text("description").notNull().default(""),
});

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type RoleCategory = typeof roleCategories.$inferSelect;
export type JoinableRole = typeof joinableRoles.$inferSelect;
