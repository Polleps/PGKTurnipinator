import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import {
  canRunCommand,
  CommandHandler,
  findCommand,
  FixbotCommand,
  HelpCommand,
  PingCommand,
  PostFlairTextCommand,
  ReloadTournamentCacheCommand,
  STAFF_ONLY_MESSAGE,
} from "./commands";
import { BasicSetCache } from "./stores";
import { store } from "./Store";
import { createLogger } from "./utils/logger";

const log = createLogger("CommandController");

/** Dispatches slash commands. Construct after store.init(). */
export default class CommandController {
  private handlers: Map<string, CommandHandler>;
  private botadmins: BasicSetCache;

  constructor() {
    this.botadmins = store.cache("botadmins") as BasicSetCache;
    this.handlers = new Map<string, CommandHandler>([
      ["ping", new PingCommand()],
      ["help", new HelpCommand(this.botadmins)],
      ["postflairtext", new PostFlairTextCommand()],
      ["reloadcache", new ReloadTournamentCacheCommand()],
      ["fixbot", new FixbotCommand()],
    ]);
  }

  public async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = findCommand(interaction.commandName);
    const handler = this.handlers.get(interaction.commandName);

    if (!command || !handler) {
      // Registered in Discord but not known to this build (stale registration).
      await interaction.reply({ content: "Unknown command.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!canRunCommand(command, interaction.user.id, this.botadmins)) {
      await interaction.reply({ content: STAFF_ONLY_MESSAGE, flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      await handler.execute(interaction);
    } catch (err) {
      log(err);
      const content = "Er is iets fout gegaan, neem contact op met de staff.";
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(content).catch(log);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(log);
      }
    }
  }
}
