import * as admin from "firebase-admin";
import * as serviceAccount from "../firebasekey.json";
import { Firestore } from "@google-cloud/firestore";
import { ICache } from "./stores/StoreCache.js";
import { BasicSetCache, JoinableRoleCache, TournamentStoreCache } from "./stores/index.js";
import Config from "./Config";

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

    this.caches = new Map<string, ICache>([
      ["joinableroles", new JoinableRoleCache(this.db.collection("joinableroles"))],
      ["shucfixes", new BasicSetCache(this.db.collection("shucfixes"), "prefix")],
      ["shucfixbans", new BasicSetCache(this.db.collection("shucfixbans"), "id")],
      ["botadmins", new BasicSetCache(this.db.collection("botadmins"), "id")],
      ["tournaments", new TournamentStoreCache(this.db.collection(Config.TOURNAMENT_COLLECTION_NAME))],
    ]);
  }

  public collection(name: string) {
    return this.db.collection(name);
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
