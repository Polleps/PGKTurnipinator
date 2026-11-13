import { CollectionReference } from "@google-cloud/firestore";
import { isCollectionWritable, ReadOnlyCollectionError } from "./writeGuard";

export interface ICache {
  readonly collectionId: string;
  readonly writable: boolean;
  init(): Promise<void>;
}
export default abstract class StoreCache<T, I, O> implements ICache {
  protected ref: CollectionReference;
  protected cache!: T;
  public readonly writable: boolean;

  /**
   * @param writable Whether writes to the collection are allowed. Defaults to the
   * local data-safety guard, so a cache is read-only unless explicitly allowed.
   */
  constructor(collection: CollectionReference, writable: boolean = isCollectionWritable(collection.id)) {
    this.ref = collection;
    this.writable = writable;
  }

  public get collectionId(): string {
    return this.ref.id;
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

  public abstract add(x: O): Promise<void>;

  public abstract has(index: I): boolean;

  protected async fillCache(force: boolean = false): Promise<void> {
    return Promise.resolve();
  }

  /** Throws a ReadOnlyCollectionError unless this cache may write to its collection. */
  protected assertWritable(operation: string): void {
    if (!this.writable) {
      throw new ReadOnlyCollectionError(this.collectionId, operation);
    }
  }

  public get data(): T {
    return this.cache;
  }
}
