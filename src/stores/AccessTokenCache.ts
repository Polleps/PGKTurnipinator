import StoreCache from "./StoreCache";
import { CollectionReference } from "@google-cloud/firestore";
import { IEncryptedUserAccessToken, IDecryptedUserAccessToken } from "../interfaces/IUserAccessToken";
export class AccessTokenCache extends StoreCache<Map<string, IDecryptedUserAccessToken>,
 string, IDecryptedUserAccessToken> {

  constructor(collection: CollectionReference) {
    super(collection);
    this.cache = new Map<string, IDecryptedUserAccessToken>();
  }

  public async add(x: IDecryptedUserAccessToken) {
    try {
      await this.ref.add(x);
      this.cache.set(x.userKey, x);
    } catch (e) {
      console.error(e);
    }
  }

  public has(index: string): boolean {
    return this.cache.has(index);
  }

  public update() {

  }

  protected async fillCache(): Promise<void> {
    const snapshot = await this.ref.get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      this.cache.set(data.userKey, data as IDecryptedUserAccessToken);
    });
    return;
  }

  private async decrypt(entry: IEncryptedUserAccessToken): Promise<IDecryptedUserAccessToken> {

  }
}
