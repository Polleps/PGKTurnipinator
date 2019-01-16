"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Command {
    constructor() {
        this._isAdminCommand = false;
        this._isPublic = true;
        this._usage = "Command not yet implemented";
        this._description = "Command not yet implemented";
    }
    run(message, args) {
        return false;
    }
    get tag() {
        return this._tag;
    }
    get usage() {
        return this._usage;
    }
    get description() {
        return this._description;
    }
    get isAdminCommand() {
        return this._isAdminCommand;
    }
    get isPublic() {
        return this._isPublic;
    }
}
exports.default = Command;
