import { Request, Response, Router } from "express";
import { Client, Guild } from "discord.js";
import Config from "../../Config";

export class ServerInfoRouter {
  private readonly expireTime = 3600000;

  private _router: Router;
  private cachedInfo: IServerInfo;
  private client: Client;
  private lastUpdated: number = 0;

  constructor(discordClient: Client) {
    this._router = Router();
    this.client = discordClient;
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this.router.get("/membercount", (req: Request, res: Response) => {
      this.updateInfo();
      res.status(200).json({ count: this.cachedInfo.memberCount });
    });
  }

  private updateInfo() {
    if ((Date.now() - this.lastUpdated) > this.expireTime) {
      const PGK = this.client.guilds.get(Config.GUILD_ID);
      this.cachedInfo = {
        memberCount: PGK.memberCount,
      };
      this.lastUpdated = Date.now();
    }
  }
}

interface IServerInfo {
  memberCount: number;
}
