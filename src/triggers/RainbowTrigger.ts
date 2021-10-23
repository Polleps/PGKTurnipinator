import * as Discord from "discord.js";

import { ITrigger } from "./ITrigger";
import Config from "../Config";

export class RainbowTrigger implements ITrigger {

  public run(message: Discord.Message): boolean {
    if (message.guild.id !== Config.GUILD_ID) {
      return false;
    }

    const role = message.guild.roles.cache.get(Config.COLOR_ROLE_ID);
    if (role) {
      role.setColor('RANDOM');
      return false;
    }

    message.guild.roles.fetch(Config.COLOR_ROLE_ID).then((fetchedRole) => {
      fetchedRole.setColor('RANDOM');
    });
  }
}
