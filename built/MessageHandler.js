"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CommandController_1 = require("./CommandController");
const Context_1 = require("./Context");
const TriggerController_1 = require("./TriggerController");
class MessageHandler {
    constructor() {
        this.tiggerController = new TriggerController_1.default();
        this.commandController = new CommandController_1.default();
    }
    processMessage(message) {
        // Message should not be processed if it was posted by the bot.
        if (message.author.id === Context_1.sClient.client.user.id) {
            return;
        }
        // Commands should not be excecuted if one of the triggers returns true.
        if (!this.tiggerController.runTriggers(message)) {
            this.commandController.processMessage(message);
        }
    }
}
exports.default = MessageHandler;
