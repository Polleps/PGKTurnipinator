import * as Discord from "discord.js";
import { Command } from "./Command";

export class SeedDBCommand extends Command {
  constructor() {
    super();
    this._tag = "seeddb";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
    this._isAdminCommand = true;
    this._isPublic = false;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    message.reply("Nothing to seed");
    return true;
  }
}
