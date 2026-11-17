import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import Config from "../Config";

/**
 * Answers members with one of NEE_ROLE_IDS with "Nee!" and deletes their message.
 * Uses only the author, member roles and channel, never message.content, so it
 * needs no MessageContent intent.
 */
/** True when any of the member's roles is one of NEE_ROLE_IDS. */
export const hasNeeRole = (memberRoleIds: Iterable<string>, neeRoleIds: readonly string[] = Config.NEE_ROLE_IDS) => {
  for (const id of memberRoleIds) {
    if (neeRoleIds.includes(id)) {
      return true;
    }
  }
  return false;
};

/** What a NEE member gets instead of a command (v13: the trigger answered "Nee!" before command parsing). */
export const NEE_COMMAND_REPLY = "Nee!";

export class NeeTrigger implements ITrigger {
  public run(msg: Discord.Message): boolean {
    const { member } = msg;

    if (member && hasNeeRole(member.roles.cache.keys())) {
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
