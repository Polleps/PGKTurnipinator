import { RichEmbed, Message } from "discord.js";
import { Command } from "./Command";
import Config from "../Config";
import { IJoinableRole, JoinableRoleCache } from "../stores";
import { store } from "../Store";

export class PostFlairTextCommand extends Command {
  private roles: JoinableRoleCache;
  constructor() {
    super();
    this._tag = "postflairtext";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
    this._isPublic = false;
    this._isAdminCommand = true;
    this.roles = store.cache("joinableroles") as JoinableRoleCache;
  }

  public run(message: Message, args?: string[]): boolean {
    this.roles.data.forEach((role) => {
      message.channel.send(formatedMessage(role));
    });
    return true;
  }

}

const formatedMessage = (role: IJoinableRole): RichEmbed => {
  const embed = new RichEmbed();
  embed.title = role.name;
  embed.setColor(11931720);
  if (role.description) {
    embed.setDescription(role.description);
  }

  embed.addField("\u200B", `[Add](${formatActionURL(role, true)}) | [Remove](${formatActionURL(role, false)})`);

  return embed;
}

const formatActionURL = (role: IJoinableRole, join: boolean): URL =>
  new URL(`${Config.SERVERURL}/?action=flair&perform=${join ? "add" : "remove"}&role=${role.name}`);
