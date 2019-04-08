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
    const embeds = sList.lists[LIST.JOINABLEROLES].data.map((role) => formatedMessage(role));
    embeds.forEach((embed) => {
      message.channel.send(embed);
    });
    return true;
  }

}

const formatedMessage = (role: IJoinableRoles): RichEmbed => {
  const embed = new RichEmbed();
  embed.title = role.key;
  embed.setColor(11931720);
  if (role.description) {
    embed.setDescription(role.description);
  }

  embed.addField("\u200B", `[Add](${formatActionURL(role, true)}) | [Remove](${formatActionURL(role, false)})`);

  return embed;
}

const formatActionURL = (role: IJoinableRoles, join: boolean): URL =>
  new URL(`${Config.SERVERURL}/?action=flair&perform=${join ? "add" : "remove"}&role=${role.key}`);
