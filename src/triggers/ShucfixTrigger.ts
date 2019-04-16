import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import { BasicSetCache } from "../stores";
import { store } from "../Store";

export class ShucfixTrigger implements ITrigger {
  private shucID: string = "164482857702522881";
  private shucfixCache: BasicSetCache;
  constructor() {
    this.shucfixCache = store.cache("shucfixes") as BasicSetCache;
  }

  public run(msg: Discord.Message): boolean {
    if (msg.author.id === this.shucID) {
      const prefix = this.fetchRandomName();
      const nickname = prefix.length < 25 ? `${prefix} | ShuC` : `${prefix}|ShuC`;
      msg.member.setNickname(nickname, "ShuCFixing");
    }
    return false;
  }

  private fetchRandomName(): string {
    return this.shucfixCache.random();
  }
}
