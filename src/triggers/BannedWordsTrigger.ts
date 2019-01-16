import * as Discord from "discord.js";
import { sList } from "../Context";
import { LIST } from "../ListLoader";
import { IList } from "../lists";
import { ITrigger } from "./ITrigger";

export class BannedWordsTrigger implements ITrigger {
  private list: IList[];
  constructor() {
    this.list = sList.lists[LIST.BANNEDWORDS].data;
  }
  public run(msg: Discord.Message): boolean {
    const content = msg.content.toLowerCase();
    const word = this.list.find((l) => {
      return content.includes(l.key);
    });

    if (word) {
      msg.reply(`Message was removed because it contained the word: ${word.key}`);
      msg.delete();
      return true;
    }
    return false;
  }
}
