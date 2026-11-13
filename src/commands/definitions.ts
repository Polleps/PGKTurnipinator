import {
  InteractionContextType,
  PermissionFlagsBits,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";

/**
 * The bot's slash commands as registered in Discord (scripts/register-commands.ts).
 * Pure data: no store or client, so the registration script and tests can import it.
 */
export interface CommandDefinition {
  name: string;
  description: string;
  /** Shown by /help <command>. */
  usage: string;
  /** Only bot admins (the botadmins collection) may run it; enforced by CommandController. */
  adminOnly: boolean;
  /** Listed by /help for everyone (admin-only commands are listed for admins only). */
  isPublic: boolean;
  data: { toJSON(): RestPostCommand };
}

type RestPostCommand = RESTPostAPIChatInputApplicationCommandsJSONBody;

/**
 * Discord-side first gate for admin-only commands: hides them from members without
 * Manage Server unless a server admin adds an override (Server Settings > Integrations).
 * The botadmins check in CommandController stays the authority.
 */
export const ADMIN_DEFAULT_PERMISSIONS = PermissionFlagsBits.ManageGuild;

type CommandInfo = Omit<CommandDefinition, "data">;

const define = (
  info: CommandInfo,
  addOptions: (builder: SlashCommandBuilder) => CommandDefinition["data"] = (builder) => builder,
): CommandDefinition => {
  const builder = new SlashCommandBuilder()
    .setName(info.name)
    .setDescription(info.description)
    .setContexts(InteractionContextType.Guild);

  if (info.adminOnly) {
    builder.setDefaultMemberPermissions(ADMIN_DEFAULT_PERMISSIONS);
  }

  return { ...info, data: addOptions(builder) };
};

export const commandDefinitions: readonly CommandDefinition[] = [
  define({
    name: "ping",
    description: "It's just ping",
    usage: "Type `/ping`",
    adminOnly: false,
    isPublic: true,
  }),
  define(
    {
      name: "help",
      description: "Lists the bot's commands.",
      usage: "Type `/help`, or `/help command:<name>` for one command",
      adminOnly: false,
      isPublic: true,
    },
    (builder) =>
      builder.addStringOption((option) =>
        option.setName("command").setDescription("Show the details of one command").setRequired(false),
      ),
  ),
  define({
    name: "postflairtext",
    description: "Posts the role selector (one menu per role category) in this channel.",
    usage: "Type `/postflairtext` in the channel that should get the role menus",
    adminOnly: true,
    isPublic: false,
  }),
  define({
    name: "reloadcache",
    description: "Clears the cache and fetches all tournament data from the database.",
    usage: "Type `/reloadcache` to reload the tournament cache",
    adminOnly: true,
    isPublic: false,
  }),
  define({
    name: "fixbot",
    description: "Restarts the bot.",
    usage: "Type `/fixbot`",
    adminOnly: true,
    isPublic: false,
  }),
];

export const findCommand = (name: string): CommandDefinition | undefined =>
  commandDefinitions.find((c) => c.name === name);

/** Request body for a bulk overwrite of the guild's commands. */
export const commandsJSON = (): RestPostCommand[] => commandDefinitions.map((c) => c.data.toJSON());
