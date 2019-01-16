"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Config {
    constructor() {
    }
}
Config.CommandPrefix = process.env.COMMAND_PREFIX;
Config.TestToken = process.env.TOKEN;
Config.BotAdmins = JSON.parse(process.env.BOT_ADMINS);
Config.EnableWebServer = (process.env.EnableWebServer === "true");
Config.ServerPort = +process.env.SERVERPORT;
Config.AccountRefExpireTime = +process.env.ACCOUNT_REF_EXPIRE_TIME;
exports.default = Config;
