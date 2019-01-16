import * as Discord from "discord.js";
import { Command } from "./Command";
import { LIST } from "../ListLoader";
import { sList } from "../Context";

export class JoinCommand extends Command {
  constructor() {
    super();
    this._tag = "join";
    this._usage = ``;
    // tslint:disable-next-line:max-line-length
    this._description = `Use the join command to get access to certain roles, Use \`${this._prefix}join roles\` to see which roles you get access to.`;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!args) {
      this.sendUsage(message);
      return true;
    }
    const roles = sList.lists[LIST.JOINABLEROLES].data.map(((role) => `${role.key}`));

    // ------ !join roles
    if (args[0].toLowerCase() === "roles") {
      message.reply(this.compileRolesList(roles)).then((m: Discord.Message) => m.delete(60000));
      return true;
    }

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

  private checkIfInList(message: Discord.Message, rolename: string, roles: string[]): boolean {
    if (!roles.some((role) => role === rolename)) {
      message.reply(`${rolename} is not a joinable role.
      use \`${this._prefix}join roles\` to get list of joinable roles`)
        .then((m: Discord.Message) => m.delete(60000));
      return false;
    }
    return true;
  }

  private compileRolesList(roles: string[]): string {
    const str = "**List of joinable roles:**\n";
    return str + roles.map((role) => `- ${role}\n`).join("");
  }
}
