import * as Discord from "discord.js";

export interface ITrigger {
  run: (msg: Discord.Message) => boolean;
}
