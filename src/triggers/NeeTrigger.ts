import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import Config from "../Config";

/**
 * Answers members with one of NEE_ROLE_IDS with "Nee!" and deletes their message.
 * Uses only the author, member roles and channel, never message.content, so it
 * needs no MessageContent intent.
 */
export class NeeTrigger implements ITrigger {
  public run(msg: Discord.Message): boolean {
    const { NEE_ROLE_IDS } = Config;
    const { member } = msg;

    if (member && NEE_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
      if (msg.channel.isSendable()) {
        msg.channel.send(`${msg.author.toString()} Nee!`).catch(console.error);
      }
      // tslint:disable-next-line:no-console
      msg.delete().catch(console.error);
      return true;
    }
    return false;
  }
}
