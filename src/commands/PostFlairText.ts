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
  private readonly optionChunkSize = 25;
  private readonly maxComponents = 5;

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
    this.runAsync(message);

    return true;
  }

  private async runAsync(message: Message) {
    const roles = Array.from(this.roles.data.values());

    await message.channel.send('In dit kanaal kan je rollen toevoegen en verwijderen.\nKlik op een dropdown om rollen te kiezen.').then;

    for (const category of this.categories.data.values()) {
      const filteredRoles = roles.filter((role) => role.category === category.name);

      const embed = this.buildCategoryEmbed(category);
      const components = this.buildComponents(category, filteredRoles);

      message.channel.send({ content: '᲼᲼᲼᲼᲼᲼', embeds: [embed], components });
    }
  }

  private buildCategoryEmbed(category: IRoleCategory) {
    const embed = new MessageEmbed()
      .setColor('#E5C07B')
      .setTitle(`${category.name}`)
      .setDescription(category.description ?? '');

    return embed;
  }

  private buildComponents(category: IRoleCategory, roles: IJoinableRole[]): MessageActionRow[] {
    const options = roles.map((role) => ({
      label: role.name,
      value: role.ID,
      ...(role.description ? {
        description: role.description.slice(0, 100),
      } : {})
    }));

    const chunks = this.splitToChunks(options, this.optionChunkSize);

    const categoryId = category.name.toLowerCase().replace(/\-/g, '');

    const isIcons = category.name.toLowerCase() === 'icons';

    const menus = chunks.map((chunk, i) => new MessageSelectMenu()
      .setCustomId(`roles-set-${categoryId}-${i}`)
      .setPlaceholder(isIcons ? "Kies een character icon" : "Kies één of meerdere rollen")
      .setMinValues(1)
      .setMaxValues(isIcons ? 1 : chunk.length)
      .addOptions(...chunk));

    if (menus.length > this.maxComponents) {
      throw new Error(`Too many components (${menus.length}) for category ${category.name}`);
    };

    const rows = menus.map((menu) => new MessageActionRow().addComponents(menu));

    return rows;
  }

  private splitToChunks<T>(arr: T[], maxSize: number): Array<T[]> {
    const collection = [];

    for (let i = 0; i < arr.length; i += maxSize) {
      const chunk = arr.slice(i, i + maxSize);
      collection.push(chunk);
    }

    return collection;
  }
}
