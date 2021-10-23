import { ButtonInteraction, Client, Guild, GuildMemberRoleManager, Interaction, Message, MessageActionRow, MessageButton, MessageComponent, SelectMenuInteraction } from "discord.js";

interface PendingFlair {
  values: string[];
  interaction: SelectMenuInteraction;
}

export class InteractionHandler {
  private pendingFlairs = new Map<string, PendingFlair>([]);
  private client: Client;

  constructor(client) {
    this.client = client;
  }

  public handle(interaction: Interaction) {
    if (interaction.isSelectMenu()) {
      this.handleSelect(interaction);

      return;
    }

    if (interaction.isButton()) {
      this.handleButton(interaction);

      return;
    }
  }

  private async handleSelect(interaction: SelectMenuInteraction) {
    if (!interaction.customId.startsWith('roles-set')) {
      return;
    }

    const category = interaction.customId.replace('roles-set-', '');
    const userFlairKey = `${interaction.user.id}-${category}`;

    const addButton = new MessageButton()
      .setCustomId(`flair-add-${category}`)
      .setLabel('Toevoegen')
      .setStyle('PRIMARY');

    const removeButton = new MessageButton()
      .setCustomId(`flair-remove-${category}`)
      .setLabel('Verwijderen')
      .setStyle('SECONDARY');

    const guild = await this.client.guilds.fetch(interaction.guildId);
    await guild.roles.fetch();

    const chosenRoles = interaction.values.map((role) => guild.roles.cache.get(role).name);
    const chosenRolesText = chosenRoles.reduce((acc, current, index) => {
      if (index === 0) {
        return `**${current}**`;
      }

      return `${acc}${index === chosenRoles.length - 1 ? " en" : ","} **${current}**`;
    }, '');

    interaction.reply({
      content: `Wil je ${chosenRolesText} toevoegen of verwijderen?`,
      components: [
        new MessageActionRow().addComponents([addButton, removeButton]),
      ],
      ephemeral: true
    })
      .then(() => {
        this.pendingFlairs.set(userFlairKey, {
          values: interaction.values,
          interaction,
        });
      })
      .catch(console.error);
  }

  private async handleButton(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith('flair')) {
      return;
    }

    const category = interaction.customId
      .replace('flair-add-', '')
      .replace('flair-remove-', '');

    const key = `${interaction.user.id}-${category}`;
    const pendingFlair = this.pendingFlairs.get(key);

    const guild = this.client.guilds.cache.get(interaction.guildId);
    const member = await guild.members.fetch(interaction.user.id);

    try {
      if (interaction.customId.startsWith('flair-add')) {
        member.roles.add(pendingFlair.values);

        await interaction.update({
          content: 'De rollen zijn toegevoegd!',
          components: [],
        });

        this.resetSelect(pendingFlair.interaction);
      } else {
        member.roles.remove(pendingFlair.values);

        await interaction.update({
          content: 'De rollen zijn verwijderd!',
          components: [],
        });

        this.resetSelect(pendingFlair.interaction);
      }
    } catch (e) {
      this.respondWithError(interaction);
    }

    this.pendingFlairs.delete(key);
  }

  private resetSelect(select: SelectMenuInteraction) {
    const { message } = select;

    (select.message as Message).edit({
      content: message.content,
      embeds: message.embeds,
      components: message.components as MessageActionRow[],
    })
  }

  private respondWithError(interaction: ButtonInteraction | SelectMenuInteraction) {
    interaction.followUp({
      content: 'Er is iets fout gegaan, neem contact op met de staff.',
      ephemeral: true,
    });
  }
}
