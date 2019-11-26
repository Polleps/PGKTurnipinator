import { RichEmbed, Message } from "discord.js";
import { Command } from "./Command";
import Config from "../Config";
import { JoinableRoleCache } from "../stores";
import IJoinableRole from "../interfaces/IJoinableRole";
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
    const roles = Array.from(this.roles.data.values());
    const provinceRoles = roles.filter((r) => r.description === "provincie");
    const normalRoles = roles.filter((r) => r.description !== "provincie");
    normalRoles.forEach((role) => {
      message.channel.send(formattedMessage(role));
    });
    message.channel.send(formatProvinceMessage(provinceRoles));
    return true;
  }

}

const formattedMessage = (role: IJoinableRole): RichEmbed => {
  const embed = new RichEmbed();
  const formatControls = controlLinkBuilder(embed, { useRoleTitle: false, inline: false });
  embed.title = role.name;
  embed.setColor(11931720);
  if (role.description) {
    embed.setDescription(role.description);
  }

  formatControls(role);

  return embed;
}

const formatProvinceMessage = (roles: IJoinableRole[]): RichEmbed => {
  const embed = new RichEmbed();
  const formatControls = controlLinkBuilder(embed, { useRoleTitle: true, inline: true });
  embed.title = "Province Roles";
  embed.setColor(11931720);
  embed.setDescription("Give your self a province role so you can be notified when something smash related is happening in your area.");
  roles.forEach((role) => formatControls(role));
  return embed;
}

const controlLinkBuilder = (embed: RichEmbed, options: { useRoleTitle: boolean, inline: boolean }) => {
  return (role: IJoinableRole) => {
    embed.addField(
      options.useRoleTitle ? role.name : "\u200B",
      `[Add](${formatActionURL(role, true)}) | [Remove](${formatActionURL(role, false)})`,
      options.inline,
    );
  };
};

const formatActionURL = (role: IJoinableRole, join: boolean): URL =>
  new URL(`${Config.SERVERURL}/bot?action=flair&perform=${join ? "add" : "remove"}&role=${role.name}`);
