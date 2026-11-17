import { CommandDefinition } from "./commands/definitions";

/**
 * Text for /help. Without a command name: the public commands. With one: its details,
 * except that non-public commands only exist for bot admins.
 */
export const buildHelpText = (
  commands: readonly CommandDefinition[],
  isAdmin: boolean,
  commandName?: string | null,
): string => {
  if (!commandName) {
    const lines = ["**Command List**"];
    for (const command of commands) {
      if (command.isPublic) {
        lines.push(`\`/${command.name}\`: ${command.description}`);
      }
    }
    return lines.join("\n");
  }

  const tag = commandName.replace(/^\//, "").toLowerCase();
  const command = commands.find((c) => c.name === tag);

  if (!command || (!command.isPublic && !isAdmin)) {
    return `${tag} is not a command.`;
  }

  return `**${tag}**:\n**Description**: ${command.description}\n**Usage**: ${command.usage}`;
};
