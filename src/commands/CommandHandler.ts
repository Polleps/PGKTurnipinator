import { ChatInputCommandInteraction } from "discord.js";

/** Runs one slash command; see definitions.ts for the command itself. */
export interface CommandHandler {
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
