import * as Discord from "discord.js";
import { Command } from "./Command";
import { LIST } from "../ListLoader";
import { sList } from "../Context";

export class LeaveCommand extends Command {
  constructor() {
    super();
    this._tag = "leave";
    this._usage = ``;
    // tslint:disable-next-line:max-line-length
    this._description = `Use the leave command to remove a certain roles`;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!args) {
      this.sendUsage(message);
      return true;
    }
    const roles = sList.lists[LIST.JOINABLEROLES].data.map(((role) => `${role.key}`));

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

  private removeRoleFromUser(message: Discord.Message, rolename: string): void {
    const dRole = message.guild.roles.find((role) => role.name === rolename);
    message.member.removeRole(dRole, "Removed by user")
      // tslint:disable-next-line:max-line-length
      .then(() => message.reply(`Removed ${rolename}`).then((m: Discord.Message) => m.delete(30000)))
      .catch((err) => console.log(err));
  }

  private checkIfUserHasRole(message: Discord.Message, rolename: string): boolean {
    const memberRoles = message.member.roles;
    if (!memberRoles.some((role) => role.name === rolename)) {
      message.reply("You don't have this role.").then((m: Discord.Message) => m.delete(30000));
      return false;
    }
    return true;
  }

  private checkIfInServer(message: Discord.Message, rolename: string): boolean {
    if (!message.guild.roles.some((role) => role.name === rolename)) {
      message.reply("Role does not exist in this server.").then((m: Discord.Message) => m.delete(30000));
      return false;
    }
    return true;
  }

  private checkIfInList(message: Discord.Message, rolename: string, roles: string[]): boolean {
    if (!roles.some((role) => role === rolename)) {
      message.reply(`${rolename} can not be removed.`)
        .then((m: Discord.Message) => m.delete(60000));
      return false;
    }
    return true;
  }
}
