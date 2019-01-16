"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class FixbotCommand extends Command_1.Command {
    constructor() {
        super();
        this._tag = "fixbot";
        this._usage = `Type \`${this._prefix}fixbot\``;
        this._description = "Restarts the bot.";
        this._isPublic = false;
        this._isAdminCommand = true;
    }
    run(message, args) {
        message.reply("Restarting... please wait 10 seconds.");
        message.delete();
        process.exit();
        return true;
    }
}
exports.FixbotCommand = FixbotCommand;
