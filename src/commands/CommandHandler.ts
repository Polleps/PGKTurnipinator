import { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";

/** Runs one slash command; see definitions.ts for the command itself. */
export interface CommandHandler {
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  /** Suggestions for an option with autocomplete; Discord needs the answer within 3 seconds. */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}
