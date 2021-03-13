import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import { BasicSetCache } from "../stores";
import { store } from "../Store";
import Config from "../Config";
export class ShucfixTrigger implements ITrigger {
  private shucID: string = "164482857702522881";
  private shucfixCache: BasicSetCache;
  constructor() {
    this.shucfixCache = store.cache("shucfixes") as BasicSetCache;
  }

  public run(msg: Discord.Message): boolean {
    if (!Config.SHUCFIX_GUILD_IDS.includes(msg.guild.id)) {
      return false;
    }

    let nickname: string = "";
    if (msg.author.id === this.shucID) {
      try {
        const prefix = this.fetchRandomName();
        nickname = prefix.length < 25 ? `${prefix} | ShuC` : `${prefix}|ShuC`;
      } catch (e) {
        console.error(e);
      }

      if (nickname !== "") {
        // tslint:disable-next-line:no-console
        msg.member.setNickname(nickname, "ShuCFixing").catch(console.error);
      }
    }
    return false;
  }

  private fetchRandomName(): string {
    return this.shucfixCache.random();
  }
}
