// Work on one tournament's Discord message, event and row (posting it, deleting it) runs one
// after another; the bot is a single process. E.g. a second click on Post waits for the first
// post's message id and then edits that message instead of sending another one.
const tournamentLocks = new Map<string, Promise<unknown>>();

/** Runs `run` after any earlier run for the same tournament id has settled. */
export const withTournamentLock = async <T>(id: string, run: () => Promise<T>): Promise<T> => {
  const previous = tournamentLocks.get(id) ?? Promise.resolve();
  const current = previous.then(run);
  // The tail never rejects, so a failed run doesn't fail the next one.
  const tail = current.catch(() => {});
  tournamentLocks.set(id, tail);
  try {
    return await current;
  } finally {
    // The last run of a tournament removes its entry, so the map doesn't grow.
    if (tournamentLocks.get(id) === tail) {
      tournamentLocks.delete(id);
    }
  }
};

/** How many tournaments have work running or waiting (for tests). */
export const pendingTournamentLocks = (): number => tournamentLocks.size;
