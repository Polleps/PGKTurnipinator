import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";

export interface IJoinableRole {
  name: string;
  description?: string;
}

export class JoinableRoleCache extends StoreCache<Map<string, IJoinableRole>, string, IJoinableRole> {
  constructor(collection: CollectionReference) {
    super(collection);
    this.cache = new Map<string, IJoinableRole>();
  }

  public async add(x: IJoinableRole): Promise<void> {
    try {
      await this.ref.add(x);
      this.cache.set(x.name, x);
    } catch (e) {
      console.error(e);
    }
  }

  public get(x: string): IJoinableRole {
    return this.cache.get(x);
  }

  public has(index: string): boolean {
    return this.cache.has(index);
  }

  protected async fillCache(): Promise<void> {
    const snapshot = await this.ref.get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.set(data.name, data as IJoinableRole);
    });
    return;
  }
}
