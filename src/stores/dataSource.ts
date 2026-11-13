import { resolve } from "path";
import { isProduction } from "./writeGuard";

/**
 * Where the Store loads its data from.
 *
 * - live: Firestore via firebase-admin (the default). Outside NODE_ENV=production
 *   the write guard keeps every collection but tournaments_dev read-only.
 * - snapshot: a JSON export from scripts/export-firestore.ts, selected with
 *   FIRESTORE_SNAPSHOT=<export dir>. firebase-admin is never loaded and writes
 *   stay in memory. Saves Firestore reads on every local boot.
 */
export type DataSource = { kind: "live" } | { kind: "snapshot"; dir: string };

export const SNAPSHOT_ENV_VAR = "FIRESTORE_SNAPSHOT";

export class SnapshotInProductionError extends Error {
  constructor() {
    super(
      `${SNAPSHOT_ENV_VAR} is set together with NODE_ENV=production. Refusing to start: ` +
        "the production bot must use live Firestore. Unset one of them.",
    );
    this.name = "SnapshotInProductionError";
  }
}

export const resolveDataSource = (env: NodeJS.ProcessEnv = process.env): DataSource => {
  const dir = env[SNAPSHOT_ENV_VAR];
  if (dir === undefined || dir === "") {
    return { kind: "live" };
  }
  if (isProduction(env.NODE_ENV)) {
    throw new SnapshotInProductionError();
  }
  return { kind: "snapshot", dir: resolve(dir) };
};
