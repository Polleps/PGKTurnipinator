import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandHandler } from "./CommandHandler";

/** Exits; the process manager restarts the bot. */
export class FixbotCommand implements CommandHandler {
  public async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: "Restarting... please wait 10 seconds.", flags: MessageFlags.Ephemeral });
    process.exit();
  }
}
