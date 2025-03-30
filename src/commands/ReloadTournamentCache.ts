import * as Discord from "discord.js";
import { Command } from "./Command";
import type { TournamentStoreCache } from "../stores";
import { store } from "../Store";

export class ReloadTournamentCacheCommand extends Command {
  private tournamentCache: TournamentStoreCache;

  constructor() {
    super();
    this._tag = "reloadcache";
    this._usage = `Type \`${this._prefix}reloadcache to reload the tournament cache\``;
    this._description =
      "Clears the cache and fetches all tournament data from the database.";
    this._isPublic = false;
    this._isAdminCommand = true;
    this.tournamentCache = store.cache("tournaments") as TournamentStoreCache;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    message.reply("Reloading cache.").then(() => {
      message.delete();
      this.tournamentCache.updateCache();
    });
    return true;
  }
}
