"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_1 = require("./commands");
class CommandFactory {
    createCommand(tag) {
        switch (tag) {
            case "ping":
                return new commands_1.PingCommand();
            case "fixbot":
                return new commands_1.FixbotCommand();
            case "join":
                return new commands_1.JoinCommand();
            case "leave":
                return new commands_1.LeaveCommand();
            case "register":
                return new commands_1.RegisterCommand();
            default:
                throw new Error("Command Does not exist");
        }
    }
}
CommandFactory.commandList = [
    "ping",
    "fixbot",
    "join",
    "leave",
    "register",
];
exports.default = CommandFactory;
