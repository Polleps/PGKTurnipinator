import type { NormalizedTournament } from "../db/normalizeTournament";

/**
 * A tournament as the bot handles it: the `tournaments` row shape (see src/db/schema.ts),
 * dates as epoch ms. A stored row (`Tournament`) also has the start.gg status fields.
 */
type ITournament = NormalizedTournament;
export default ITournament;
