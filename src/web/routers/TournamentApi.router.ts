import { Request, Response, Router } from "express";
import { store } from "../../Store";
import type { Tournament } from "../../db/schema";
import type { TournamentCursor, TournamentFilter, TournamentRepository } from "../../db/TournamentRepository";

/**
 * `GET /api/tournaments`: tournaments in pages of `{ items, nextCursor }`.
 *
 *   from, to   epoch ms; tournaments overlapping [from, to): end_date >= from AND start_date < to.
 *              Default: from = now, no to (upcoming and ongoing).
 *   online     "true" | "false"
 *   url        exact start.gg slug; newest edition first. Ignores the default `from`; no cursor.
 *   limit      1..100 (larger values are clamped), default 20
 *   cursor     opaque, the previous response's nextCursor
 *
 * Items are ordered by (start_date, id) and carry public fields only, dates in ms; NULL
 * columns are left out. Invalid or repeated values of these parameters get `400 { error }`;
 * other parameters are ignored.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const CACHE_CONTROL = "public, max-age=60";

const PARAMS = ["from", "to", "online", "url", "limit", "cursor"] as const;
type Param = (typeof PARAMS)[number];

export type PublicTournament = Partial<Omit<Tournament, "messageID" | "guildEventID">>;

export interface TournamentPageResponse {
  items: PublicTournament[];
  nextCursor: string | null;
}

/** Drops the Discord ids and NULL columns. */
export const toPublicTournament = (t: Tournament): PublicTournament => {
  const { messageID: _m, guildEventID: _g, ...rest } = t;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null)) as PublicTournament;
};

export const encodeCursor = (c: TournamentCursor): string =>
  Buffer.from(JSON.stringify([c.startDate, c.id])).toString("base64url");

export const decodeCursor = (cursor: string): TournamentCursor | undefined => {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      Number.isSafeInteger(value[0]) &&
      typeof value[1] === "string" &&
      value[1] !== ""
    ) {
      return { startDate: value[0] as number, id: value[1] };
    }
  } catch {
    // fall through
  }
  return undefined;
};

export class BadRequest extends Error {}

export type TournamentQuery =
  | { kind: "page"; filter: TournamentFilter; limit: number; after?: TournamentCursor }
  | { kind: "url"; url: string; filter: TournamentFilter; limit: number };

/** Validates the query string. Throws BadRequest with a message meant for the client. */
export const parseTournamentQuery = (query: Request["query"], now: number): TournamentQuery => {
  // Only the known names are read, as own properties into a prototype-less map: other
  // parameters (cache busters, utm_*, __proto__, constructor, ...) are ignored.
  const values: Partial<Record<Param, string>> = Object.create(null);
  for (const name of PARAMS) {
    if (!Object.hasOwn(query, name)) {
      continue;
    }
    const value: unknown = query[name];
    if (typeof value !== "string") {
      throw new BadRequest(`Parameter "${name}" must be given once, as a plain value.`);
    }
    values[name] = value;
  }

  const epochMs = (name: "from" | "to"): number | undefined => {
    const v = values[name];
    if (v === undefined) {
      return undefined;
    }
    const n = Number(v);
    if (!/^\d+$/.test(v) || !Number.isSafeInteger(n)) {
      throw new BadRequest(`"${name}" must be a time in epoch milliseconds (a non-negative integer).`);
    }
    return n;
  };
  const from = epochMs("from");
  const to = epochMs("to");
  if (from !== undefined && to !== undefined && to <= from) {
    throw new BadRequest(`"to" must be after "from".`);
  }

  let online: boolean | undefined;
  if (values.online !== undefined) {
    if (values.online !== "true" && values.online !== "false") {
      throw new BadRequest(`"online" must be "true" or "false".`);
    }
    online = values.online === "true";
  }

  let limit = DEFAULT_LIMIT;
  if (values.limit !== undefined) {
    if (!/^\d+$/.test(values.limit) || Number(values.limit) < 1) {
      throw new BadRequest(`"limit" must be a positive integer (at most ${MAX_LIMIT}).`);
    }
    limit = Math.min(Number(values.limit), MAX_LIMIT);
  }

  if (values.url !== undefined) {
    if (values.url.trim() === "") {
      throw new BadRequest(`"url" must not be empty.`);
    }
    if (values.cursor !== undefined) {
      throw new BadRequest(`"cursor" can't be combined with "url".`);
    }
    // No default `from`: a featured tournament may already have ended.
    return { kind: "url", url: values.url, filter: { from, to, online }, limit };
  }

  let after: TournamentCursor | undefined;
  if (values.cursor !== undefined) {
    after = decodeCursor(values.cursor);
    if (!after) {
      throw new BadRequest(`"cursor" is not valid; pass the nextCursor of a previous response.`);
    }
  }
  return { kind: "page", filter: { from: from ?? now, to, online }, limit, after };
};

export const queryTournaments = (repo: TournamentRepository, query: TournamentQuery): TournamentPageResponse => {
  if (query.kind === "url") {
    return { items: repo.byUrl(query.url, query.filter, query.limit).map(toPublicTournament), nextCursor: null };
  }
  const page = repo.page(query.filter, query.limit, query.after);
  return { items: page.items.map(toPublicTournament), nextCursor: page.next ? encodeCursor(page.next) : null };
};

export class TournamentApiRouter {
  private _router: Router;

  constructor(
    private readonly repo: () => TournamentRepository = () => store.tournaments,
    private readonly now: () => number = Date.now,
  ) {
    this._router = Router();
    this._router.get("/", (req: Request, res: Response) => {
      let query: TournamentQuery;
      try {
        query = parseTournamentQuery(req.query, this.now());
      } catch (e) {
        if (e instanceof BadRequest) {
          res.status(400).json({ error: e.message });
          return;
        }
        throw e;
      }
      res.setHeader("Cache-Control", CACHE_CONTROL);
      res.status(200).json(queryTournaments(this.repo(), query));
    });
  }

  public get router() {
    return this._router;
  }
}
