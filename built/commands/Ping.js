"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
class PingCommand extends Command_1.Command {
    constructor() {
        super();
        this._tag = "ping";
        this._usage = `Type \`${this._prefix}ping\``;
        this._description = "It's just ping";
    }
    run(message, args) {
        message.reply("Pong");
        return true;
    }
}
exports.PingCommand = PingCommand;
