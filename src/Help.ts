import * as Discord from "discord.js";
import { Command } from "./commands/Command";
import Config from "./Config";

export default class Help {
  private _commands: Map<string, Command>;

  constructor(commands: Map<string, Command>) {
    this._commands = commands;
  }

  public getHelp(author: Discord.User, args: string[]): string {
    if (args.length === 0) {
      return this.generateHelpText();
    } else {
      return this.getHelpFromCommand(author, args[0]);
    }
  }

  private generateHelpText(): string {
    const helpText: string[] = ["**Command List**"];
    for (const [key, command] of this._commands) {
      if (command.isPublic) {
        helpText.push(`\`${Config.CommandPrefix}${key}\`: ${command.description}`);
      }
    }
    return helpText.join("\n");
  }

  private getHelpFromCommand(author: Discord.User, tag: string): string {
    if (!this._commands.has(tag)) {
      return `${tag} is not a command.`;
    }
    const command = this._commands.get(tag);

    if (!command.isPublic && !Config.BotAdmins.some((x) => x === author.id)) {
      return `${tag} is not a command.`;
    }

    return `**${tag}**:\n**Description**: ${command.description}\n**Usage**: ${command.usage}`;
  }
}
