"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Config_1 = require("./Config");
class Help {
    constructor(commands) {
        this._commands = commands;
    }
    getHelp(author, args) {
        if (args.length === 0) {
            return this.generateHelpText();
        }
        else {
            return this.getHelpFromCommand(author, args[0]);
        }
    }
    generateHelpText() {
        const helpText = ["**Command List**"];
        for (const [key, command] of this._commands) {
            if (command.isPublic) {
                helpText.push(`\`${Config_1.default.CommandPrefix}${key}\`: ${command.description}`);
            }
        }
        return helpText.join("\n");
    }
    getHelpFromCommand(author, tag) {
        if (!this._commands.has(tag)) {
            return `${tag} is not a command.`;
        }
        const command = this._commands.get(tag);
        if (!command.isPublic && !Config_1.default.BotAdmins.some((x) => x === author.id)) {
            return `${tag} is not a command.`;
        }
        return `**${tag}**:\n**Description**: ${command.description}\n**Usage**: ${command.usage}`;
    }
}
exports.default = Help;
