import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { CommandHandler } from "./CommandHandler";
import type { TournamentStoreCache } from "../stores";
import { store } from "../Store";

export class ReloadTournamentCacheCommand implements CommandHandler {
  private tournamentCache: TournamentStoreCache;

  constructor() {
    this.tournamentCache = store.cache("tournaments") as TournamentStoreCache;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: "Reloading cache.", flags: MessageFlags.Ephemeral });
    await this.tournamentCache.updateCache();
    await interaction.editReply("Cache reloaded.");
  }
}
