import { RichEmbed, Message } from "discord.js";
import { Command } from "./Command";
import { LIST } from "../ListLoader";
import { sList } from "../Context";
import { IJoinableRoles } from "../lists";
import Config from "../Config";

export class PostFlairTextCommand extends Command {
  constructor() {
    super();
    this._tag = "postflairtext";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
    this._isPublic = false;
    this._isAdminCommand = true;
  }

  public run(message: Message, args?: string[]): boolean {
    message.reply("Pong");
    return true;
  }

}

// const formatedMessage = (role: IJoinableRoles): RichEmbed => {
//   const embed = new RichEmbed();
//   embed.title = role.key;

// }

const formatActionURL = (role: IJoinableRoles, join: boolean): string =>
  `${Config.SERVERURL}/?action=flair&perform=${join ? "add" : "remove"}&role=${role.key}`;
