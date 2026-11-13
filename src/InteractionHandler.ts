import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  Interaction,
  MessageFlags,
  StringSelectMenuInteraction,
} from "discord.js";

interface PendingFlair {
  values: string[];
  interaction: StringSelectMenuInteraction;
}

/** "**a**", "**a** en **b**", "**a**, **b** en **c**" */
export const formatRoleNames = (names: string[]): string =>
  names.reduce((acc, current, index) => {
    if (index === 0) {
      return `**${current}**`;
    }

    return `${acc}${index === names.length - 1 ? " en" : ","} **${current}**`;
  }, "");

/** The picked role IDs that still exist, with their names; deleted roles are skipped. */
export const knownRoles = (
  roleIds: readonly string[],
  nameOf: (id: string) => string | undefined,
): { id: string; name: string }[] =>
  roleIds.flatMap((id) => {
    const name = nameOf(id);
    return name === undefined ? [] : [{ id, name }];
  });

export const buildFlairButtons = (category: string): ActionRowBuilder<ButtonBuilder> => {
  const addButton = new ButtonBuilder()
    .setCustomId(`flair-add-${category}`)
    .setLabel("Toevoegen")
    .setStyle(ButtonStyle.Primary);

  const removeButton = new ButtonBuilder()
    .setCustomId(`flair-remove-${category}`)
    .setLabel("Verwijderen")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(addButton, removeButton);
};

export class InteractionHandler {
  private pendingFlairs = new Map<string, PendingFlair>([]);
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  public handle(interaction: Interaction) {
    if (interaction.isStringSelectMenu()) {
      this.handleSelect(interaction).catch(console.error);

      return;
    }

    if (interaction.isButton()) {
      this.handleButton(interaction).catch(console.error);

      return;
    }
  }

  private async handleSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.customId.startsWith("roles-set")) {
      return;
    }

    const category = interaction.customId.replace("roles-set-", "");
    const userFlairKey = `${interaction.user.id}-${category}`;

    let chosen: { id: string; name: string }[];
    try {
      const guild = await this.client.guilds.fetch(interaction.guildId!);
      await guild.roles.fetch();
      chosen = knownRoles(interaction.values, (id) => guild.roles.cache.get(id)?.name);
    } catch (e) {
      console.error(e);
      await this.respondWithError(interaction);
      return;
    }

    if (chosen.length === 0) {
      // Every picked role was deleted since the menu was posted.
      await this.respondWithError(interaction);
      return;
    }

    interaction
      .reply({
        content: `Wil je ${formatRoleNames(chosen.map((r) => r.name))} toevoegen of verwijderen?`,
        components: [buildFlairButtons(category)],
        flags: MessageFlags.Ephemeral,
      })
      .then(() => {
        this.pendingFlairs.set(userFlairKey, {
          values: chosen.map((r) => r.id),
          interaction,
        });
      })
      .catch(console.error);
  }

  private async handleButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("flair")) {
      return;
    }

    const category = interaction.customId.replace("flair-add-", "").replace("flair-remove-", "");

    const key = `${interaction.user.id}-${category}`;
    const pendingFlair = this.pendingFlairs.get(key);

    if (!pendingFlair) {
      // E.g. the bot restarted between the select and the button press.
      await this.respondWithError(interaction);

      return;
    }

    // Acknowledge within Discord's 3s deadline; the member fetch and role change can be
    // rate limited. The result (or error) then replaces the ephemeral prompt via editReply.
    await interaction.deferUpdate();

    const isAdd = interaction.customId.startsWith("flair-add");

    try {
      const guild = await this.client.guilds.fetch(interaction.guildId!);
      const member = await guild.members.fetch(interaction.user.id);

      if (isAdd) {
        await member.roles.add(pendingFlair.values);
      } else {
        await member.roles.remove(pendingFlair.values);
      }

      await interaction.editReply({
        content: isAdd ? "De rollen zijn toegevoegd!" : "De rollen zijn verwijderd!",
        components: [],
      });

      // Cosmetic; the roles are already changed, so a failure here isn't reported.
      this.resetSelect(pendingFlair.interaction).catch(console.error);
    } catch (e) {
      console.error(e);
      await this.respondWithError(interaction);
    }

    this.pendingFlairs.delete(key);
  }

  /** Re-sends the role message unchanged, which clears the user's selection in the menu. */
  private async resetSelect(select: StringSelectMenuInteraction) {
    const { message } = select;

    await message.edit({
      content: message.content,
      embeds: message.embeds,
      components: message.components,
    });
  }

  private async respondWithError(interaction: ButtonInteraction | StringSelectMenuInteraction) {
    const content = "Er is iets fout gegaan, neem contact op met de staff.";

    if (interaction.deferred || interaction.replied) {
      // Replaces the ephemeral prompt (and its buttons); fall back to a new ephemeral message.
      await interaction
        .editReply({ content, components: [] })
        .catch(() => interaction.followUp({ content, flags: MessageFlags.Ephemeral }))
        .catch(console.error);
    } else if (interaction.isButton()) {
      // The button sits on the user's ephemeral prompt; replace it.
      await interaction.update({ content, components: [] }).catch(console.error);
    } else {
      // Never update() a select: that would edit the public role selector message.
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(console.error);
    }
  }
}
