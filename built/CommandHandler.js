"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CommandFactory_1 = require("./CommandFactory");
const Config_1 = require("./Config");
const Help_1 = require("./Help");
class CommandHandler {
    constructor(context) {
        this._context = context;
        this._commandFactory = new CommandFactory_1.default(context);
        this._commands = new Map();
        CommandFactory_1.default.commandList.forEach((c) => {
            this._commands.set(c, this._commandFactory.createCommand(c));
        });
        this._help = new Help_1.default(this._commands);
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
            const shouldRemoveMessage = this._commands.get(commandTag).run(message, messageArr);
            if (shouldRemoveMessage) {
                message.delete();
            }
        }
        else {
            message.reply(`${commandTag} is not a command.\nType \`${Config_1.default.CommandPrefix}help\` to see a list of available commands.`);
            message.delete();
        }
    }
}
exports.default = CommandHandler;
