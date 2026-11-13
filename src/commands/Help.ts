import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandHandler } from "./CommandHandler";
import { commandDefinitions } from "./definitions";
import { AdminLookup } from "./permissions";
import { buildHelpText } from "../Help";

export class HelpCommand implements CommandHandler {
  constructor(private admins: AdminLookup) {}

  public async execute(interaction: ChatInputCommandInteraction) {
    const content = buildHelpText(
      commandDefinitions,
      this.admins.has(interaction.user.id),
      interaction.options.getString("command"),
    );
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
