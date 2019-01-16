"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SClient {
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    get client() {
        return this._client;
    }
    set client(value) {
        if (!this._client) {
            this._client = value;
        }
        else {
            throw new Error("client is already defined.");
        }
    }
}
// tslint:disable-next-line:max-classes-per-file
class SLists {
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    get lists() {
        return this._lists;
    }
    set lists(value) {
        if (!this._lists) {
            this._lists = value;
        }
        else {
            throw new Error("lists is already defined.");
        }
    }
}
exports.sClient = SClient.Instance;
exports.sList = SLists.Instance;
