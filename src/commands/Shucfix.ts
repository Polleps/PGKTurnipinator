import { Message, RichEmbed } from "discord.js";
import { Command } from "./Command";
import { BasicSetCache } from "../stores";
import { store } from "../Store";

const shucImages = [
  "https://cdn.discordapp.com/emojis/362934801935630339.png?v=1",
  "https://cdn.discordapp.com/emojis/587207975954022410.png?v=1",
  "https://cdn.discordapp.com/emojis/818897146412793887.png?v=1",
];

export class ShucfixCommand extends Command {
  private shucfixCache: BasicSetCache;
  private shucfixBans: BasicSetCache;

  constructor() {
    super();
    this._tag = "shucfix";
    this._usage = `\`${this._prefix}${this._tag} [text]\``;
    this._description = "Add a shucfix.";
    this.shucfixCache = store.cache("shucfixes") as BasicSetCache;
    this.shucfixBans = store.cache("shucfixbans") as BasicSetCache;
  }

  public run(message: Message, args?: string[]): boolean {
    if (this.shucfixBans.has(message.author.id)) {
      return true;
    }

    // Command may not be used by ShuC himself.
    if (message.author.id === "164482857702522881") {
      message.reply(":P");
      return true;
    }

    if (!this.verify(args)) {
      this.sendUsage(message);
      return true;
    }

    const prefix = args.join(" ").trim();
    if (prefix.length > 27) {
      message.reply("This shucfix is to long. Shucfixes can't be longer than 27 characters.");
      return false;
    }

    this.addPrefix(message, prefix);

    return true;
  }

  private addPrefix(msg: Message, prefix: string): void {
    if (this.shucfixCache.has(prefix)) {
      msg.reply(`${prefix} is already a shucfix`);
      return;
    }
    this.shucfixCache.add(prefix)
      .then(() => {
        const embed = new RichEmbed();
        embed
          .setAuthor(msg.member.displayName, msg.author.avatarURL)
          .setDescription(`Added **${prefix}** to the list of shucfixes`)
          .setThumbnail(shucImages[Math.floor(Math.random() * shucImages.length)])
          .setFooter("!shucfix [text]");
        msg.channel.sendEmbed(embed);
      });
  }

  private verify(args?: string[]): boolean {
    if (!args) { return false; }
    if (args.length === 0) { return false; }
    // if (args.join(" ").trim().length > 27) { return false; }
    return true;
  }
}
