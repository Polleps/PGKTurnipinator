import * as Discord from "discord.js";
import { Command } from "./Command";
import { store } from "../Store";
import { JoinableRoleCache } from "../stores";

export class LeaveCommand extends Command {
  private roleCache: JoinableRoleCache;

  constructor() {
    super();
    this._tag = "leave";
    this._usage = ``;
    // tslint:disable-next-line:max-line-length
    this._description = `Use the leave command to remove a certain roles`;
    this.roleCache = store.cache("joinableroles") as JoinableRoleCache;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!args) {
      this.sendUsage(message);
      return true;
    }
    const rolename = args.join(" ").trim();

    if (!this.checkIfUserHasRole(message, rolename)) {
      return true;
    }

    if (!this.checkIfInServer(message, rolename)) {
      return true;
    }
    if (!this.roleCache.has(rolename)) {
      message.reply(`${rolename} cannot be removed.`);
      return true;
    }
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
}
