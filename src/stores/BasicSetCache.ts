import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";

export class BasicSetCache extends StoreCache<Set<string>, string, string> {
  private prop: string;

  constructor(collection: CollectionReference, prop: string) {
    super(collection);
    this.prop = prop;
    this.cache = new Set<string>();
  }

  public async add(x: string): Promise<void> {
    try {
      await this.ref.add({ [this.prop]: x });
      this.cache.add(x);
    } catch (e) {
      console.error(e);
    }
  }

  public async delete(x: string): Promise<void> {
    try {
      const snapshot = await this.ref.where(this.prop, "==", x).get();
      if (!snapshot.empty) {
        snapshot.forEach((doc) => this.ref.doc(doc.id).delete());
      }
      this.cache.delete(x);
    } catch (e) {
      console.error(e);
    }
  }

  public random(): string {
    return [...this.cache.values()][Math.floor(Math.random() * this.cache.size)];
  }

  public has(index: string): boolean {
    return this.cache.has(index);
  }

  public async seed(data: string[]) {
    return Promise.all(data.map((item) => this.add(item)));
  }

  protected async fillCache(): Promise<void> {
    const snapshot = await this.ref.get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.add(data[this.prop] as string);
    });
    return;
  }
}
