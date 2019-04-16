import { Message } from "discord.js";
import { Command } from "./Command";
import { BasicSetCache } from "../stores";
import { store } from "../Store";

export class ShucfixCommand extends Command {
  private shucfixCache: BasicSetCache;

  constructor() {
    super();
    this._tag = "shucfix";
    this._usage = `\`${this._prefix}${this._tag} [add/remove] [text]\``;
    this._description = "Add or remove shucfixes.";
    this.shucfixCache = store.cache("shucfixes") as BasicSetCache;
  }

  public run(message: Message, args?: string[]): boolean {
    // Command may not be used by ShuC himself.
    if (message.author.id === "164482857702522881") {
      message.reply(":P");
      return true;
    }

    if (!this.verify(args)) {
      this.sendUsage(message);
      return true;
    }

    const order = args.shift();
    const prefix = args.join(" ");

    if (order.toLowerCase() === "add") {
      this.addPrefix(message, prefix);
    } else if (order.toLowerCase() === "remove") {
      this.removePrefix(message, prefix);
    }

    return true;
  }

  private addPrefix(msg: Message, prefix: string): void {
    if (this.shucfixCache.has(prefix)) {
      msg.reply(`${prefix} is already a shucfix`);
      return;
    }
    this.shucfixCache.add(prefix)
      .then(() => msg.reply(`${prefix} is now a shucfix`));
  }

  private removePrefix(msg: Message, prefix: string): void {
    if (!this.shucfixCache.has(prefix)) {
      msg.reply(`${prefix} is not a shucfix`);
      return;
    }
    this.shucfixCache.delete(prefix)
      .then(() => msg.reply(`removed ${prefix} from shucfixes`));
  }

  private verify(args?: string[]): boolean {
    if (!args) { return false; }
    if (args.length < 2) { return false; }
    if (args[0].toLowerCase() !== "add" && args[0].toLowerCase() !== "remove") { return false; }
    return true;
  }
}
