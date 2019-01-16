import * as Discord from "discord.js";
import { Command } from "./Command";

export class FixbotCommand extends Command {
  constructor() {
    super();
    this._tag = "fixbot";
    this._usage = `Type \`${this._prefix}fixbot\``;
    this._description = "Restarts the bot.";
    this._isPublic = false;
    this._isAdminCommand = true;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    message.reply("Restarting... please wait 10 seconds.");
    message.delete();
    process.exit();
    return true;
  }
}
