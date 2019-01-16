"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DBManager {
    constructor() {
        this.lists = new Map();
    }
    static get Insance() {
        return this._instance || (this._instance = new this());
    }
    contains(listName, listItem) {
        if (this.lists.has(listName)) {
            return this.lists.get(listName).data.some((x) => x === listItem);
        }
        else {
            throw new Error("List does not exist");
        }
    }
}
exports.default = DBManager;
