import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";

export class BasicMapCache<T> extends StoreCache<Map<string, T>, string, T> {
  private mapIndex: string;

  constructor(collection: CollectionReference, mapIndex: string) {
    super(collection);
    this.cache = new Map<string, T>();
    this.mapIndex = mapIndex;
  }

  public async add(x: T): Promise<void> {
    try {
      await this.ref.add(x);
      this.cache.set(x[this.mapIndex], x);
    } catch (e) {
      console.error(e);
    }
  }

  public get(x: string): T {
    return this.cache.get(x);
  }

  public has(index: string): boolean {
    return this.cache.has(index);
  }

  protected async fillCache(): Promise<void> {
    const snapshot = await this.ref.get();

    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.set(data[this.mapIndex], data as T);
    });

    return;
  }
}
