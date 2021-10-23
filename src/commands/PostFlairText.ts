import { Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu } from "discord.js";
import { Command } from "./Command";
import Config from "../Config";
import { store } from "../Store";
import { BasicMapCache } from "../stores/BasicMapCache";
import { IJoinableRole } from "../models/IJoinableRole";
import { IRoleCategory } from "../models/IRoleCategory";

export class PostFlairTextCommand extends Command {
  private roles: BasicMapCache<IJoinableRole>;
  private categories: BasicMapCache<IRoleCategory>;

  constructor() {
    super();
    this._tag = "postflairtext";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
    this._isPublic = false;
    this._isAdminCommand = true;
    this.roles = store.cache("joinableroles") as BasicMapCache<IJoinableRole>;
    this.categories = store.cache("role_categories") as BasicMapCache<IRoleCategory>;
  }

  public run(message: Message, args?: string[]): boolean {
    this.runAsync(message)

    return true;
  }

  private async runAsync(message: Message) {
    const roles = Array.from(this.roles.data.values());

    await message.channel.send('In dit kanaal kan je rollen toevoegen en verwijderen.\nKlik op een dropdown om rollen te kiezen.').then;

    for (const category of this.categories.data.values()) {
      const filteredRoles = roles.filter((role) => role.category === category.name);

      const [embed, components] = this.buildCategoryEmbed(category, filteredRoles);

      message.channel.send({ content: '᲼᲼᲼᲼᲼᲼', embeds: [embed], components });
    }
  }

  private buildCategoryEmbed(category: IRoleCategory, roles: IJoinableRole[]): [MessageEmbed, MessageActionRow[]] {
    const embed = new MessageEmbed()
      .setColor('#E5C07B')
      .setTitle(`${category.name} rollen`)
      .setDescription(category.description ?? '');

    const options = roles.map((role) => ({
      label: role.name,
      value: role.ID,
      ...(role.description ? {
        description: role.description.slice(0, 100),
      } : {})
    }))

    const categoryId = category.name.toLowerCase().replace(/\-/g, '');

    const select = new MessageSelectMenu()
      .setCustomId(`roles-set-${categoryId}`)
      .setPlaceholder("Kies één of meerdere rollen")
      .setMinValues(1)
      .setMaxValues(roles.length)
      .addOptions(...options);

    const rows = [ new MessageActionRow().addComponents(select) ];

    return [embed, rows];
  }
}
