import * as Discord from "discord.js";
import CommandFactory from "./CommandFactory";
import { Command } from "./commands/Command";
import Config from "./Config";
import { sList } from "./Context";
import Help from "./Help";
import { LIST } from "./ListLoader";
import { IList } from "./lists";

export default class CommandController {
  private _commandFactory: CommandFactory;
  private _commands: Map<string, Command>;
  private _help: Help;
  private botminList: IList[];

  constructor() {
    this._commandFactory = new CommandFactory();
    this._commands = new Map<string, Command>();
    CommandFactory.commandList.forEach((c) => {
      this._commands.set(c, this._commandFactory.createCommand(c));
    });
    this._help = new Help(this._commands);
    this.botminList = sList.lists[LIST.BOTADMINS].data;
  }

  public processMessage(message: Discord.Message): void {
    if (message.content.substring(0, 1) !== Config.CommandPrefix) {
      return;
    }
    const commandMessage = message.content.substring(1);
    const messageArr = commandMessage.split(" ");
    const commandTag = messageArr.shift();

    if (commandTag.toLowerCase() === "help") {
      message.reply(this._help.getHelp(message.author, messageArr));
      message.delete();
      return;
    }

    if (this._commands.has(commandTag)) {
      const command = this._commands.get(commandTag);
      // Admin commands should only be able to be used by botadmins.
      if (command.isAdminCommand && !this.isBotAdmin(message.author)) {
        message.reply("This command can only be used by the staff.");
        message.delete();
        return;
      }
      // If excecuting the command returns true the users message should be removed.
      const shouldRemoveMessage = command.run(message, messageArr);
      if (shouldRemoveMessage) {
        message.delete();
      }
    } else {
      message.reply(
        `${commandTag} is not a command.\nType \`${
        Config.CommandPrefix}help\` to see a list of available commands.`);
      message.delete();
    }
  }

  private isBotAdmin(user: Discord.User): boolean {
    return this.botminList.some((x) => x.key === user.id);
  }
}
