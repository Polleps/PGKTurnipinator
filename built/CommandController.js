"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CommandFactory_1 = require("./CommandFactory");
const Config_1 = require("./Config");
const Context_1 = require("./Context");
const Help_1 = require("./Help");
const ListLoader_1 = require("./ListLoader");
class CommandController {
    constructor() {
        this._commandFactory = new CommandFactory_1.default();
        this._commands = new Map();
        CommandFactory_1.default.commandList.forEach((c) => {
            this._commands.set(c, this._commandFactory.createCommand(c));
        });
        this._help = new Help_1.default(this._commands);
        this.botminList = Context_1.sList.lists[ListLoader_1.LIST.BOTADMINS].data;
    }
    processMessage(message) {
        if (message.content.substring(0, 1) !== Config_1.default.CommandPrefix) {
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
        }
        else {
            message.reply(`${commandTag} is not a command.\nType \`${Config_1.default.CommandPrefix}help\` to see a list of available commands.`);
            message.delete();
        }
    }
    isBotAdmin(user) {
        return this.botminList.some((x) => x.key === user.id);
    }
}
exports.default = CommandController;
