import { Message } from "discord.js";
import { Command } from "./Command";
import { BasicSetCache } from "../stores";
import { store } from "../Store";

export class ShucfixManageCommand extends Command {
  private shucfixCache: BasicSetCache;
  private shucfixBans: BasicSetCache;

  constructor() {
    super();
    this._tag = "shucfix-manage";
    // tslint:disable-next-line:max-line-length
    this._usage = `\`${this._prefix}${this._tag} remove [shucfix]\`\n\`${this._prefix}${this._tag} ban [user id]\`\n\`${this._prefix}${this._tag} unban [user id]`;
    this._description = "Manage Shucfixes.";
    this._isPublic = false;
    this._isAdminCommand = true;
    this.shucfixCache = store.cache("shucfixes") as BasicSetCache;
    this.shucfixBans = store.cache("shucfixbans") as BasicSetCache;
  }

  public run(message: Message, args?: string[]): boolean {
    if (!this.verify(args)) {
      this.sendUsage(message);
      return true;
    }

    const subCommand = args.shift().toLowerCase();

    if (subCommand === "remove") {
      const prefix = args.join(" ").trim();
      this.removePrefix(message, prefix);
    } else if (subCommand === "ban") {
      this.banUser(message, args[0].trim());
    } else if (subCommand === "unban") {
      this.unbanUser(message, args[0].trim());
    }

    return true;
  }

  private removePrefix(msg: Message, prefix: string): void {
    if (!this.shucfixCache.has(prefix)) {
      msg.reply(`${prefix} is not a shucfix`);
      return;
    }
    this.shucfixCache.delete(prefix)
      .then(() => msg.reply(`removed ${prefix} from shucfixes`));
  }

  private banUser(msg: Message, userId: string): void {
    if (!this.shucfixBans.has(userId)) {
      this.shucfixBans.add(userId);
      msg.reply("User is now banned from adding more shucfixes.");
    } else {
      msg.reply("This user is already banned from posting shucfixes.");
    }
  }

  private unbanUser(msg: Message, userId: string): void {
    if (this.shucfixBans.has(userId)) {
      this.shucfixBans.delete(userId).then(() => msg.reply("Lifted ban on posting shucfixes for this User."));
    } else {
      msg.reply("User was not banned.");
    }
  }

  private verify(args?: string[]): boolean {
    if (!args) { return false; }
    if (args.length < 2) { return false; }
    const sub = args[0].toLowerCase();
    if (!["remove", "unban", "ban"].includes(sub)) { return false; }
    return true;
  }
}
