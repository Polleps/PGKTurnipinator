"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
const models_1 = require("../models");
const uuid = require("uuid/v1");
class RegisterCommand extends Command_1.Command {
    constructor() {
        super();
        this._tag = "register";
        // this._usage = `Type \`${this._prefix}ping\``;
        this._description = "Use this to create a new PGK Account!";
    }
    run(message, args) {
        const userID = message.author.id;
        const UserModel = new models_1.User().getModelForClass(models_1.User);
        UserModel.findOne({ discordID: userID }).exec().then((value) => {
            if (value) {
                message.reply("You already have an account.").then((msg) => msg.delete(10000));
            }
            else {
                this.createNewRef(message);
            }
        }).catch((err) => console.log(err));
        return true;
    }
    createNewRef(message) {
        const userID = message.author.id;
        const ref = uuid();
        const AccountRefModel = new models_1.AccountRef().getModelForClass(models_1.AccountRef);
        const accountRef = new AccountRefModel({ refLink: ref, discordID: userID });
        accountRef.save().then().catch((err) => console.log(err));
    }
}
exports.RegisterCommand = RegisterCommand;
