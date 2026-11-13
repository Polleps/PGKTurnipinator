import { ChatInputCommandInteraction, GuildMember, MessageFlags } from "discord.js";
import {
  CommandHandler,
  findCommand,
  FixbotCommand,
  HelpCommand,
  PingCommand,
  PostFlairTextCommand,
  ReloadTournamentCacheCommand,
} from "./commands";
import { createLogger } from "./utils/logger";
import { hasNeeRole, NEE_COMMAND_REPLY } from "./triggers";

const log = createLogger("CommandController");

/** Role IDs of the invoking member (a cached GuildMember, or the raw API member). */
const memberRoleIds = (interaction: ChatInputCommandInteraction): Iterable<string> => {
  const { member } = interaction;
  if (member instanceof GuildMember) {
    return member.roles.cache.keys();
  }
  return member?.roles ?? [];
};

/**
 * Dispatches slash commands. Construct after store.init().
 *
 * Admin-only commands are gated by Discord alone: they default to Manage Server, and server
 * admins can grant them to other roles or members (Server Settings > Integrations). Discord
 * enforces that before the interaction reaches the bot, so it is deliberately not re-checked here.
 */
export default class CommandController {
  private handlers: Map<string, CommandHandler>;

  constructor() {
    this.handlers = new Map<string, CommandHandler>([
      ["ping", new PingCommand()],
      ["help", new HelpCommand()],
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

    // As in v13, where NeeTrigger answered these members before any command ran.
    if (hasNeeRole(memberRoleIds(interaction))) {
      await interaction.reply({ content: NEE_COMMAND_REPLY, flags: MessageFlags.Ephemeral });
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
