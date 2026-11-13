import { IUserInfo, fetchUserInfo } from "./discord.agent";

class UserInfoCache {
  private static instance: UserInfoCache;
  public static get Instance() {
    return this.instance || (this.instance = new UserInfoCache());
  }

  private cache: Map<string, IUserInfo>;
  private readonly maxCache: number = 100;

  private constructor() {
    this.cache = new Map<string, IUserInfo>();
  }

  public async get(accessToken: string): Promise<IUserInfo> {
    if (this.cache.has(accessToken)) {
      return this.cache.get(accessToken)!;
    }
    const fetchedInfo = await fetchUserInfo(accessToken);

    if (this.cache.size > this.maxCache) {
      // FIXME: indexing an iterator yields undefined, so this never evicts anything.
      // Kept as-is in Phase 0 (no behavior change); intended: this.cache.keys().next().value.
      this.cache.delete((this.cache.keys() as unknown as string[])[0]);
    }

    this.cache.set(accessToken, fetchedInfo);
    return fetchedInfo;
  }
}

export default UserInfoCache.Instance;
