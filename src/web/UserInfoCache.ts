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
      return this.cache.get(accessToken);
    }
    const fetchedInfo = await fetchUserInfo(accessToken);

    if (this.cache.size > this.maxCache) {
      this.cache.delete(this.cache.keys()[0]);
    }

    this.cache.set(accessToken, fetchedInfo);
    return fetchedInfo;
  }
}

export default UserInfoCache.Instance;
