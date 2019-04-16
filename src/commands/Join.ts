import * as Discord from "discord.js";
import { Command } from "./Command";
import { store } from "../Store";
import { JoinableRoleCache } from "../stores";

export class JoinCommand extends Command {
  private roleCache: JoinableRoleCache;

  constructor() {
    super();
    this._tag = "join";
    this._usage = ``;
    // tslint:disable-next-line:max-line-length
    this._description = `Use the join command to get access to certain roles, Use \`${this._prefix}join roles\` to see which roles you get access to.`;
    this.roleCache = store.cache("joinableroles") as JoinableRoleCache;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!args) {
      this.sendUsage(message);
      return true;
    }

    // ------ !join [role name]
    const rolename = args.join(" ").trim();
    // Roll should exist in the server the message was posted in.
    if (!this.checkIfInServer(message, rolename)) {
      return true;
    }

    if (!this.roleCache.has(rolename)) {
      message.reply(`${rolename} is not joinable role`);
      return true;
    }

    if (!this.checkIfUserHasRole(message, rolename)) {
      return true;
    }

    this.addRoleToUser(message, rolename);
    return true;
  }

  private addRoleToUser(message: Discord.Message, rolename: string): void {
    const dRole = message.guild.roles.find((role) => role.name === rolename);
    message.member.addRole(dRole, "Flaired by user")
      // tslint:disable-next-line:max-line-length
      .then(() => message.reply(`CONGRATS! You are now part of ${rolename}`).then((m: Discord.Message) => m.delete(30000)))
      .catch((err) => console.log(err));
  }

  private checkIfUserHasRole(message: Discord.Message, rolename: string): boolean {
    const memberRoles = message.member.roles;
    if (memberRoles.some((role) => role.name === rolename)) {
      message.reply("You already have this role.").then((m: Discord.Message) => m.delete(30000));
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
