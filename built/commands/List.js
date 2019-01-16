"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
const Context_1 = require("../Context");
class ListCommand extends Command_1.Command {
    constructor() {
        super();
        this._tag = "list";
        this._usage = `\`${this._prefix}list [list] [add/remove/show] <value>\``;
        this._description = "Edit Lists";
        this._isAdminCommand = true;
        this._isPublic = false;
    }
    run(message, args) {
        const listname = args[0];
        const list = Context_1.sList.lists.find((x) => x.name === listname);
        if (!list) {
            message.reply(`${listname} is not a list`);
        }
        return true;
    }
    compileListMessage(list) {
        return `**Contents of ${list.name}:**
    ${list.data.map((x) => `- ${x.key}`).join("\n")}`;
    }
}
exports.ListCommand = ListCommand;
