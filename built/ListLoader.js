"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lists_1 = require("./lists");
class ListLoader {
    static loadLists() {
        return new Promise((resolve, reject) => {
            const lists = new Array(new lists_1.List("bannedwords.json"), new lists_1.BannedUserWordsList("banneduserwords.json"), new lists_1.List("botadmins.json"), new lists_1.List("joinableroles.json"), new lists_1.List("editablelists.json"));
            Promise.all(lists.map((l) => l.load()))
                .then(() => resolve(lists));
        });
    }
    constructor() { }
}
exports.default = ListLoader;
var LIST;
(function (LIST) {
    LIST[LIST["BANNEDWORDS"] = 0] = "BANNEDWORDS";
    LIST[LIST["BANNEDUSERWORDS"] = 1] = "BANNEDUSERWORDS";
    LIST[LIST["BOTADMINS"] = 2] = "BOTADMINS";
    LIST[LIST["JOINABLEROLES"] = 3] = "JOINABLEROLES";
    LIST[LIST["EDITABLELISTS"] = 4] = "EDITABLELISTS";
})(LIST = exports.LIST || (exports.LIST = {}));
