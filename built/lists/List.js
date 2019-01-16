"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class List {
    constructor(filename) {
        this._basePath = `${process.cwd()}/data/lists/`;
        this._filename = filename;
    }
    get name() {
        return this._name;
    }
    get data() {
        return this._list;
    }
    load() {
        return new Promise((resolve, reject) => {
            fs.readFile(`${this._basePath}${this._filename}`, (err, data) => {
                if (!err) {
                    const parsedData = JSON.parse(data.toString());
                    this._name = parsedData.name;
                    this._list = parsedData.list;
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
    save() {
        return new Promise((resolve, reject) => {
            const dataToSave = { name: this._name, list: this._list };
            fs.writeFile(`${this._basePath}${this._filename}`, JSON.stringify(dataToSave), (err) => {
                if (!err) {
                    resolve();
                }
                else {
                    reject(err);
                }
            });
        });
    }
}
exports.List = List;
