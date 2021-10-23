import * as Discord from "discord.js";
import CommandFactory from "./CommandFactory";
import { Command } from "./commands/Command";
import Config from "./Config";
import Help from "./Help";
import { BasicSetCache } from "./stores";
import { store } from "./Store";
import { createLogger } from "./utils/logger";

const log = createLogger("CommandController");

export default class CommandController {
  private _commandFactory: CommandFactory;
  private _commands: Map<string, Command>;
  private _help: Help;
  private botminCache: BasicSetCache;

  constructor() {
    this._commandFactory = new CommandFactory();
    this._commands = new Map<string, Command>();

    for (const c of this._commandFactory.commandList) {
      this._commands.set(c, this._commandFactory.createCommand(c));
    }

    this._help = new Help(this._commands);
    this.botminCache = store.cache("botadmins") as BasicSetCache;
  }

  public processMessage(message: Discord.Message): void {
    const commandRegex = new RegExp(`^\\${Config.CommandPrefix}{1}\\w{1,}`, "g");

    if (!commandRegex.test(message.content)) {
      return;
    }

    const commandMessage = message.content.substring(1);
    const messageArr = commandMessage.split(" ");
    const commandTag = messageArr.shift().toLowerCase();

    if (commandTag.toLowerCase() === "help") {
      message.reply(this._help.getHelp(message.author, messageArr)).then(() => {
        message.delete();
      });
      return;
    }

    if (this._commands.has(commandTag)) {
      const command = this._commands.get(commandTag);
      // Admin commands should only be able to be used by botadmins.
      if (command.isAdminCommand && !this.isBotAdmin(message.author)) {
        message.reply("This command can only be used by the staff.")
          .then(() => {
            message.delete().catch((err) => log(err));
          });
        return;
      }
      // If excecuting the command returns true the users message should be removed.
      const shouldRemoveMessage = command.run(message, messageArr);
      if (shouldRemoveMessage) {
        setTimeout(() => {
          message.delete().catch((err) => log(err));
        }, 1000);
      }
    } else {
      // message.reply(
      //   `${commandTag} is not a command.\nType \`${
      //   Config.CommandPrefix}help\` to see a list of available commands.`);
      // message.delete().catch((err) => log(err));
    }
  }

  private isBotAdmin(user: Discord.User): boolean {
    return this.botminCache.has(user.id);
  }
}
