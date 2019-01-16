import * as Discord from "discord.js";
import { Command } from "./Command";
import { LIST } from "../ListLoader";
import { sList } from "../Context";
import { List } from "../lists";

export class ListCommand extends Command {
  constructor() {
    super();
    this._tag = "list";
    this._usage = `\`${this._prefix}list [list] [add/remove/show] <value>\``;
    this._description = "Edit Lists";
    this._isAdminCommand = true;
    this._isPublic = false;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    const listname = args[0];
    const list = sList.lists.find((x) => x.name === listname);
    if (!list) {
      message.reply(`${listname} is not a list`);
    }
    return true;
  }

  private compileListMessage(list: List): string {
    return `**Contents of ${list.name}:**
    ${list.data.map((x) => `- ${x.key}`).join("\n")}`;
  }
}
