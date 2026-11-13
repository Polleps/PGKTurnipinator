import type { Tournament } from "./schema";

/**
 * A tournament as the legacy `GET /tournaments` route returns it: the old camelCase keys,
 * NULL columns left out (as absent fields were in Firestore), and `registrationClosesAt`
 * in unix seconds like start.gg sends it (the agenda multiplies it by 1000).
 */
export type LegacyTournament = { [K in keyof Tournament]?: Exclude<Tournament[K], null> };

export const toLegacyTournament = (t: Tournament): LegacyTournament => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(t)) {
    if (value === null || value === undefined) {
      continue;
    }
    out[key] = key === "registrationClosesAt" ? Math.floor((value as number) / 1000) : value;
  }
  return out as LegacyTournament;
};
