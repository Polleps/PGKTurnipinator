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
  public async init(): Promise<void> {
    try {
      await this.fillCache();
    } catch (e) {
      console.log("Could not load cache.");
      console.error(e);
    }
    return;
  }

  public abstract async add(x: O): Promise<void>;

  public abstract has(index: I): boolean;

  protected async fillCache(): Promise<void> {
    return Promise.resolve();
  }

  public get data(): T {
    return this.cache;
  }
}
