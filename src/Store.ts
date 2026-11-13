import type { CollectionReference } from "firebase-admin/firestore";
import { ICache } from "./stores/StoreCache.js";
import { TournamentStoreCache, isCollectionWritable } from "./stores/index.js";
import Config from "./Config";
import { BasicMapCache } from "./stores/BasicMapCache";
import { IJoinableRole } from "./models/IJoinableRole";
import { IRoleCategory } from "./models/IRoleCategory";
import { createLogger } from "./utils/logger";
import { DataSource, resolveDataSource, SNAPSHOT_ENV_VAR } from "./stores/dataSource";
import { loadSnapshotCollection } from "./stores/snapshot/SnapshotCollection";

const log = createLogger("Store");

type OpenCollection = (name: string) => [CollectionReference, boolean];

export interface StoreOptions {
  env?: NodeJS.ProcessEnv;
  tournamentCollection?: string;
}

export class Store {
  private static instance: Store;

  public static get Instance(): Store {
    return this.instance || (this.instance = new this());
  }

  /** Builds a separate Store (for tests); the bot uses `store`. */
  public static create(options: StoreOptions = {}): Store {
    return new Store(options);
  }

  public readonly source: DataSource;
  private caches: Map<string, ICache>;

  private constructor({ env = process.env, tournamentCollection = Config.TOURNAMENT_COLLECTION_NAME }: StoreOptions = {}) {
    // Throws (refusing to start) if FIRESTORE_SNAPSHOT is combined with NODE_ENV=production.
    this.source = resolveDataSource(env);

    let collection: OpenCollection;
    if (this.source.kind === "snapshot") {
      const dir = this.source.dir;
      log(
        `Data source: SNAPSHOT (${SNAPSHOT_ENV_VAR}=${dir}). firebase-admin is not loaded; ` +
          "writes only change memory and are logged as [snapshot] would write.",
      );
      // Snapshot caches are writable: writes never leave this process.
      collection = (name) => [loadSnapshotCollection(dir, name) as unknown as CollectionReference, true];
      tournamentCollection = tournamentCollection || "tournaments";
    } else {
      log("Data source: live Firestore.");
      // Required lazily so that snapshot mode never loads firebase-admin.
      const { openLiveFirestore } = require("./liveFirestore") as typeof import("./liveFirestore");
      const db = openLiveFirestore();

      // Every cache is read-only outside NODE_ENV=production unless its collection is
      // explicitly allowed (tournaments_dev). There is deliberately no raw collection
      // accessor: all Firestore access goes through these guarded caches.
      collection = (name) => {
        const ref = db.collection(name);
        return [ref, isCollectionWritable(ref.id, env.NODE_ENV)];
      };
    }

    const [joinableRoles, joinableRolesWritable] = collection("joinableroles");
    const [roleCategories, roleCategoriesWritable] = collection("role_categories");
    const [tournaments, tournamentsWritable] = collection(tournamentCollection);

    this.caches = new Map<string, ICache>([
      ["joinableroles", new BasicMapCache<IJoinableRole>(joinableRoles, "name", joinableRolesWritable)],
      ["role_categories", new BasicMapCache<IRoleCategory>(roleCategories, "name", roleCategoriesWritable)],
      ["tournaments", new TournamentStoreCache(tournaments, tournamentsWritable)],
    ]);

    const writable = [...this.caches.values()].filter((c) => c.writable).map((c) => c.collectionId);
    log(
      `NODE_ENV=${env.NODE_ENV ?? "(unset)"}; writable collections: ` +
        (writable.length > 0 ? writable.join(", ") : "none (read-only)") +
        (this.source.kind === "snapshot" ? " (in memory only)" : ""),
    );
  }

  public cache(name: string) {
    return this.caches.get(name);
  }

  public async init(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    this.caches.forEach((x) => promises.push(x.init()));
    await Promise.all(promises);
    return;
  }
}

export const store = Store.Instance;
