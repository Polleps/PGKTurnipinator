import { CollectionReference } from "@google-cloud/firestore";

export interface ICache {
  init(): Promise<void>;
}
export default abstract class StoreCache<T, I, O> implements ICache {
  protected ref: CollectionReference;
  protected cache: T;

  constructor(collection: CollectionReference) {
    this.ref = collection;
  }

  /**
   * Initialise Cache
   */
  public async init(): Promise<void> {
    try {
      await this.fillCache();
    } catch (e) {
      console.log("Could not load cache.");
      console.error(e);
    }
    return;
  }

  /**
   * Add data to the store.
   * @param x Data that should be added to the store.
   */
  public abstract async add(x: O): Promise<void>;

  /**
   * Check if something is in the cache and or database.
   * @param index key of the entry that is checked, type of the key depends on the type of storage the cache uses.
   */
  public abstract has(index: I): boolean;

  /**
   * The actual stored cache.
   */
  public get data(): T {
    return this.cache;
  }

  /**
   * Called when initialising store cache. may also be called when the cache needs to refresh.
   */
  protected async fillCache(): Promise<void> {
    return Promise.resolve();
  }
}
