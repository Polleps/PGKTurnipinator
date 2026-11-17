import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from "discord.js";
import { CommandHandler } from "./CommandHandler";
import { commandDefinitions } from "./definitions";
import { buildHelpText } from "../Help";

export class HelpCommand implements CommandHandler {
  public async execute(interaction: ChatInputCommandInteraction) {
    // Admin-only commands are listed for members with Manage Server (their default permission).
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    const content = buildHelpText(commandDefinitions, isAdmin, interaction.options.getString("command"));
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
