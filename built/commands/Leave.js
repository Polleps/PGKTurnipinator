"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Command_1 = require("./Command");
const ListLoader_1 = require("../ListLoader");
const Context_1 = require("../Context");
class LeaveCommand extends Command_1.Command {
    constructor() {
        super();
        this._tag = "leave";
        this._usage = ``;
        // tslint:disable-next-line:max-line-length
        this._description = `Use the leave command to remove a certain roles`;
    }
    run(message, args) {
        if (!args) {
            this.sendUsage(message);
            return true;
        }
        const roles = Context_1.sList.lists[ListLoader_1.LIST.JOINABLEROLES].data.map(((role) => `${role.key}`));
        // ------ !join [role name]
        const rolename = args.join(" ").trim();
        // Roll should exist in the server the message was posted in.
        if (!this.checkIfInServer(message, rolename)) {
            return true;
        }
        // Rolename should be in the list.
        if (!this.checkIfInList(message, rolename, roles)) {
            return true;
        }
        // User should not already have the role.
        if (!this.checkIfUserHasRole(message, rolename)) {
            return true;
        }
        // Role will be added to the user.
        this.removeRoleFromUser(message, rolename);
        return true;
    }
    removeRoleFromUser(message, rolename) {
        const dRole = message.guild.roles.find((role) => role.name === rolename);
        message.member.removeRole(dRole, "Removed by user")
            // tslint:disable-next-line:max-line-length
            .then(() => message.reply(`Removed ${rolename}`).then((m) => m.delete(30000)))
            .catch((err) => console.log(err));
    }
    checkIfUserHasRole(message, rolename) {
        const memberRoles = message.member.roles;
        if (!memberRoles.some((role) => role.name === rolename)) {
            message.reply("You don't have this role.").then((m) => m.delete(30000));
            return false;
        }
        return true;
    }
    checkIfInServer(message, rolename) {
        if (!message.guild.roles.some((role) => role.name === rolename)) {
            message.reply("Role does not exist in this server.").then((m) => m.delete(30000));
            return false;
        }
        return true;
    }
    checkIfInList(message, rolename, roles) {
        if (!roles.some((role) => role === rolename)) {
            message.reply(`${rolename} can not be removed.`)
                .then((m) => m.delete(60000));
            return false;
        }
        return true;
    }
}
exports.LeaveCommand = LeaveCommand;
