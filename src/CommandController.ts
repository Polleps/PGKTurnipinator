import { AutocompleteInteraction, ChatInputCommandInteraction, GuildMember, MessageFlags } from "discord.js";
import {
  CommandHandler,
  DeleteTournamentCommand,
  findCommand,
  FixbotCommand,
  HelpCommand,
  PingCommand,
  PostFlairTextCommand,
} from "./commands";
import { createLogger } from "./utils/logger";
import { hasNeeRole, NEE_COMMAND_REPLY } from "./triggers";

const log = createLogger("CommandController");

/** Role IDs of the invoking member (a cached GuildMember, or the raw API member). */
const memberRoleIds = (interaction: ChatInputCommandInteraction | AutocompleteInteraction): Iterable<string> => {
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
      ["fixbot", new FixbotCommand()],
      ["delete-tournament", new DeleteTournamentCommand()],
    ]);
  }

  /** Answers autocomplete for a command option; NEE members and unknown commands get no suggestions. */
  public async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const handler = this.handlers.get(interaction.commandName);
    try {
      if (!handler?.autocomplete || hasNeeRole(memberRoleIds(interaction))) {
        await interaction.respond([]);
        return;
      }
      await handler.autocomplete(interaction);
    } catch (err) {
      // Too late or already answered: Discord just shows no suggestions.
      log(err);
    }
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
