import * as Discord from "discord.js";
import Config from "../Config";

export class Command {
  protected _tag: string;
  protected _isAdminCommand: boolean;
  protected _usage: string;
  protected _description: string;
  protected _isPublic: boolean;
  protected _prefix: string;
  protected constructor() {
    this._isAdminCommand = false;
    this._isPublic = true;
    this._usage = "Command not yet implemented";
    this._description = "Command not yet implemented";
    this._prefix = Config.CommandPrefix;
  }
  public run(message: Discord.Message, args?: string[]): boolean {
    return false;
  }
  public get tag(): string {
    return this._tag;
  }

  public get usage(): string {
    return this._usage;
  }

  public get description(): string {
    return this._description;
  }

  public get isAdminCommand(): boolean {
    return this._isAdminCommand;
  }

  public get isPublic(): boolean {
    return this._isPublic;
  }

  protected sendUsage(msg: Discord.Message) {
    msg.reply(this._usage).then((m: Discord.Message) => m.delete(60000));
  }
}
