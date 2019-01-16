import * as Discord from "discord.js";
import { Command } from "./Command";

export class PingCommand extends Command {
  constructor() {
    super();
    this._tag = "ping";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    message.reply("Pong");
    return true;
  }
}
