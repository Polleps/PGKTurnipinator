import * as Discord from "discord.js";

class SClient {
  private static instance: SClient;

  public static get Instance(): SClient {
    return this.instance || (this.instance = new this());
  }

  private _client: Discord.Client;
  public get client(): Discord.Client {
    return this._client;
  }
  public set client(value: Discord.Client) {
    if (!this._client) {
      this._client = value;
    } else {
      throw new Error("client is already defined.");
    }
  }
}

export const sClient = SClient.Instance;
