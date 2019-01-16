import * as Discord from "discord.js";
import { List } from "./lists";

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

class SLists {
  private static instance: SLists;

  public static get Instance(): SLists {
    return this.instance || (this.instance = new this());
  }

  private _lists: List[];
  public get lists(): List[] {
    return this._lists;
  }
  public set lists(value: List[]) {
    if (!this._lists) {
      this._lists = value;
    } else {
      throw new Error("lists is already defined.");
    }
  }
}

export const sClient = SClient.Instance;
export const sList = SLists.Instance;
