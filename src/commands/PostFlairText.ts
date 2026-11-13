import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";
import { CommandHandler } from "./CommandHandler";
import { store } from "../Store";
import { IJoinableRole } from "../models/IJoinableRole";
import { IRoleCategory } from "../models/IRoleCategory";

const OPTION_CHUNK_SIZE = 25;
const MAX_COMPONENTS = 5;

export const FLAIR_INTRO_TEXT =
  "In dit kanaal kan je rollen toevoegen en verwijderen.\nKlik op een dropdown om rollen te kiezen.";
/** Blank-looking content above each category embed. */
export const FLAIR_SPACER_TEXT = "᲼᲼᲼᲼᲼᲼";

export const buildCategoryEmbed = (category: IRoleCategory): EmbedBuilder =>
  new EmbedBuilder()
    .setColor("#E5C07B")
    .setTitle(`${category.name}`)
    .setDescription(category.description || null);

const splitToChunks = <T>(arr: T[], maxSize: number): T[][] => {
  const collection: T[][] = [];

  for (let i = 0; i < arr.length; i += maxSize) {
    collection.push(arr.slice(i, i + maxSize));
  }

  return collection;
};

/**
 * One select menu per 25 roles of the category (custom id `roles-set-<category>-<i>`,
 * which InteractionHandler answers), each in its own action row.
 */
export const buildRoleSelectRows = (
  category: IRoleCategory,
  roles: IJoinableRole[],
): ActionRowBuilder<StringSelectMenuBuilder>[] => {
  const options = roles.map((role) => ({
    label: role.name,
    value: role.id,
    ...(role.description ? { description: role.description.slice(0, 100) } : {}),
  }));

  const chunks = splitToChunks(options, OPTION_CHUNK_SIZE);
  const categoryId = category.name.toLowerCase().replace(/-/g, "");
  const isIcons = category.name.toLowerCase() === "icons";

  const menus = chunks.map((chunk, i) =>
    new StringSelectMenuBuilder()
      .setCustomId(`roles-set-${categoryId}-${i}`)
      .setPlaceholder(isIcons ? "Kies een character icon" : "Kies één of meerdere rollen")
      .setMinValues(1)
      .setMaxValues(isIcons ? 1 : chunk.length)
      .addOptions(chunk),
  );

  if (menus.length > MAX_COMPONENTS) {
    throw new Error(`Too many components (${menus.length}) for category ${category.name}`);
  }

  return menus.map((menu) => new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
};

/** Posts the role selector: an intro message, then one message per role category. */
export class PostFlairTextCommand implements CommandHandler {
  public async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { channel } = interaction;
    if (!channel?.isSendable()) {
      await interaction.editReply("Ik kan in dit kanaal geen berichten plaatsen.");
      return;
    }

    // Build everything first, so a category that doesn't fit fails before anything is posted.
    const messages = store.roles.categories().map((category) => ({
      content: FLAIR_SPACER_TEXT,
      embeds: [buildCategoryEmbed(category)],
      components: buildRoleSelectRows(category, store.roles.rolesInCategory(category.name)),
    }));

    await channel.send(FLAIR_INTRO_TEXT);
    for (const message of messages) {
      await channel.send(message);
    }

    await interaction.editReply(`Rollenkeuze geplaatst (${messages.length} categorieën).`);
  }
}
