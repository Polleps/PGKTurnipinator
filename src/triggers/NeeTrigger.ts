import * as Discord from "discord.js";
import { ITrigger } from "./ITrigger";
import Config from "../Config";

export class NeeTrigger implements ITrigger {
  private neeUsers: Map<string[], NodeJS.Timeout>;

  constructor() {
    this.neeUsers = new Map<string[], NodeJS.Timeout>();
  }

  public run(msg: Discord.Message): boolean {
    const { NEE_ROLE_IDS } = Config;
    const { member, author, guild } = msg;

    if (NEE_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
      if (!this.neeUsers.has([ guild.id, author.id ])) {
        this.handleMuteRole(guild, member);
        msg.channel.send(`${msg.author.toString()} Nee!`);
      }
      // tslint:disable-next-line:no-console
      msg.delete().catch(console.error);
      return true;
    }
    return false;
  }

  private async handleMuteRole(guild: Discord.Guild, member: Discord.GuildMember): Promise<void> {
    const { MUTE_ROLES } = Config;
    if (MUTE_ROLES.has(guild.id)) {
      const muteRole = MUTE_ROLES.get(guild.id);

      await member.roles.add(muteRole);

      const timeoutID = setTimeout(() => {
        member.roles.remove(muteRole);
        this.neeUsers.delete([ guild.id, member.id ]);
      }, 10000);

      this.neeUsers.set([ guild.id, member.id ], timeoutID);
    }
  }
}
