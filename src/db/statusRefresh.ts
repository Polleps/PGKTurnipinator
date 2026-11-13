import { fetchTournamentStatus } from "../web/services/smashgg.service";
import { createLogger } from "../utils/logger";
import type { TournamentRepository } from "./TournamentRepository";

const log = createLogger("StatusRefresh");

/** As often as the old tournament cache expired. */
export const STATUS_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

type FetchStatus = typeof fetchTournamentStatus;

/** start.gg sends registrationClosesAt in unix seconds (or null); the DB stores ms. */
const toMs = (seconds: unknown): number | null =>
  typeof seconds === "number" && Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;

/**
 * Fetches participants and registration close time from start.gg for every tournament that
 * hasn't ended, and stores them. Returns how many tournaments were updated.
 */
export const refreshTournamentStatus = async (
  repo: TournamentRepository,
  fetchStatus: FetchStatus = fetchTournamentStatus,
  now: number = Date.now(),
): Promise<number> => {
  const upcoming = repo.upcoming(now);
  const results = await Promise.all(upcoming.map((t) => fetchStatus(t.id)));
  let updated = 0;
  for (const [status] of results.filter((r) => r.length > 0)) {
    const changed = repo.setStatus(String(status.id), {
      participants: typeof status.participants === "number" ? status.participants : null,
      registrationClosesAt: toMs(status.registrationClosesAt),
    });
    if (changed) {
      updated++;
    }
  }
  return updated;
};

/** Runs the refresh now and then every `intervalMs`. Returns a function that stops it. */
export const startStatusRefresh = (
  repo: TournamentRepository,
  intervalMs: number = STATUS_REFRESH_INTERVAL_MS,
): (() => void) => {
  let running = false;
  const run = () => {
    if (running) {
      return;
    }
    running = true;
    refreshTournamentStatus(repo)
      .then((n) => log(`Updated the start.gg status of ${n} tournament(s).`))
      .catch((e) => log(`start.gg status refresh failed: ${e}`))
      .finally(() => {
        running = false;
      });
  };
  run();
  const timer = setInterval(run, intervalMs);
  return () => clearInterval(timer);
};
