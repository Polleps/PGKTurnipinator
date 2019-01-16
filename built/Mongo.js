"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose = require("mongoose");
const models_1 = require("./models");
class MongoManager {
    constructor() {
        mongoose.connect("mongodb://localhost:27017/turnipinator");
    }
    addUser() {
        const UserModel = new models_1.User().getModelForClass(models_1.User);
        const u = new UserModel({ username: "Test", password: "Test2", discordID: "123123123132" });
        u.save();
    }
}
exports.default = MongoManager;
