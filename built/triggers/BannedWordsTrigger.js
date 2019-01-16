"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Context_1 = require("../Context");
const ListLoader_1 = require("../ListLoader");
class BannedWordsTrigger {
    constructor() {
        this.list = Context_1.sList.lists[ListLoader_1.LIST.BANNEDWORDS].data;
    }
    run(msg) {
        const content = msg.content.toLowerCase();
        const word = this.list.find((l) => {
            return content.includes(l.key);
        });
        if (word) {
            msg.reply(`Message was removed because it contained the word: ${word.key}`);
            msg.delete();
            return true;
        }
        return false;
    }
}
exports.BannedWordsTrigger = BannedWordsTrigger;
