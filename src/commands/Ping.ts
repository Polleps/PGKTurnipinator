import { ChatInputCommandInteraction } from "discord.js";
import { CommandHandler } from "./CommandHandler";

export class PingCommand implements CommandHandler {
  public async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply("Pong");
  }
}
