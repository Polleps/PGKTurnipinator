"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Discord = require("discord.js");
require("./env");
const Config_1 = require("./Config");
const Context_1 = require("./Context");
const ListLoader_1 = require("./ListLoader");
const MessageHandler_1 = require("./MessageHandler");
const server_1 = require("./web/server");
const mongoose = require("mongoose");
class Main {
    constructor(args) {
        this.args = args;
    }
    main() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = new Discord.Client();
            const lists = yield ListLoader_1.default.loadLists();
            Context_1.sClient.client = client;
            Context_1.sList.lists = lists;
            const messageHandler = new MessageHandler_1.default();
            const server = new server_1.default(client);
            if (Config_1.default.EnableWebServer) {
                yield server.start(Config_1.default.ServerPort);
            }
            mongoose.connect("mongodb://localhost:27017/turnipinator")
                .then(() => console.log("MongoDB Connected"))
                .catch(() => console.log("MongoDB failed to connect."));
            client.on("ready", () => {
                // tslint:disable-next-line:no-console
                console.log("Bot is ready");
            });
            client.on("message", (message) => {
                messageHandler.processMessage(message);
            });
            client.login(Config_1.default.TestToken);
            return;
        });
    }
}
const bot = new Main([]);
// tslint:disable-next-line:no-console
bot.main().then(() => console.log("main done"));
