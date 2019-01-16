"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const triggers_1 = require("./triggers");
class TriggerController {
    constructor() {
        this.triggers = new Array(new triggers_1.BannedWordsTrigger());
    }
    runTriggers(msg) {
        for (const trigger of this.triggers) {
            if (trigger.run(msg)) {
                return true;
            }
        }
        return false;
    }
}
exports.default = TriggerController;
