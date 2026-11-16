import type { Tournament } from "./schema";

/**
 * A tournament as the legacy `GET /tournaments` route returns it: the old camelCase keys,
 * NULL columns left out (as absent fields were in Firestore), `id` as start.gg's number
 * (as Firestore stored it), and `registrationClosesAt` in unix seconds like start.gg sends
 * it (the agenda multiplies it by 1000).
 */
export type LegacyTournament = { [K in Exclude<keyof Tournament, "id">]?: Exclude<Tournament[K], null> } & {
  id: number | string;
};

/** start.gg ids are integers; anything else (never seen) stays a string. */
const legacyId = (id: string): number | string => {
  const n = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(n) ? n : id;
};

export const toLegacyTournament = (t: Tournament): LegacyTournament => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(t)) {
    if (value === null || value === undefined) {
      continue;
    }
    out[key] =
      key === "registrationClosesAt"
        ? Math.floor((value as number) / 1000)
        : key === "id"
          ? legacyId(value as string)
          : value;
  }
  return out as LegacyTournament;
};
