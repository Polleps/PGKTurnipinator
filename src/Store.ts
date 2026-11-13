import * as admin from "firebase-admin";
import * as serviceAccount from "../firebasekey.json";
import { CollectionReference, Firestore } from "@google-cloud/firestore";
import { ICache } from "./stores/StoreCache.js";
import { BasicSetCache, TournamentStoreCache, isCollectionWritable } from "./stores/index.js";
import Config from "./Config";
import { BasicMapCache } from "./stores/BasicMapCache";
import { IJoinableRole } from "./models/IJoinableRole";
import { IRoleCategory } from "./models/IRoleCategory";
import { createLogger } from "./utils/logger";

const log = createLogger("Store");

class Store {
  private static instance: Store;

  public static get Instance(): Store {
    return this.instance || (this.instance = new this());
  }

  private db: Firestore;
  private caches: Map<string, ICache>;

  private constructor() {
    admin.initializeApp({credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)});
    this.db = admin.firestore();

    // Every cache is read-only outside NODE_ENV=production unless its collection is
    // explicitly allowed (tournaments_dev). There is deliberately no raw collection
    // accessor: all Firestore access goes through these guarded caches.
    const collection = (name: string): [CollectionReference, boolean] => {
      const ref = this.db.collection(name);
      return [ref, isCollectionWritable(ref.id)];
    };
    const [joinableRoles, joinableRolesWritable] = collection("joinableroles");
    const [roleCategories, roleCategoriesWritable] = collection("role_categories");
    const [botAdmins, botAdminsWritable] = collection("botadmins");
    const [tournaments, tournamentsWritable] = collection(Config.TOURNAMENT_COLLECTION_NAME);

    this.caches = new Map<string, ICache>([
      ["joinableroles", new BasicMapCache<IJoinableRole>(joinableRoles, "name", joinableRolesWritable)],
      ["role_categories", new BasicMapCache<IRoleCategory>(roleCategories, "name", roleCategoriesWritable)],
      ["botadmins", new BasicSetCache(botAdmins, "id", botAdminsWritable)],
      ["tournaments", new TournamentStoreCache(tournaments, tournamentsWritable)],
    ]);

    const writable = [...this.caches.values()].filter((c) => c.writable).map((c) => c.collectionId);
    log(
      `NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}; writable collections: ` +
        (writable.length > 0 ? writable.join(", ") : "none (read-only)"),
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
