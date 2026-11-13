import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import Config from "../Config";

export class NeeTrigger implements ITrigger {
  public run(msg: Discord.Message): boolean {
    const { NEE_ROLE_IDS } = Config;
    const { member } = msg;

    if (NEE_ROLE_IDS.some((roleId) => member!.roles.cache.has(roleId))) {
      msg.channel.send(`${msg.author.toString()} Nee!`);
      // tslint:disable-next-line:no-console
      msg.delete().catch(console.error);
      return true;
    }
    return false;
  }
}
