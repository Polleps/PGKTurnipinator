import * as Discord from "discord.js";
import { sList } from "../Context";
import { LIST } from "../ListLoader";
import { IList } from "../lists";
import { ITrigger } from "./ITrigger";

export class ShucfixTrigger implements ITrigger {
  private list: IList[];
  // private shucID: string = "164482857702522881";
  private shucID: string = "117237798880280590";

  constructor() {
    this.list = sList.lists[LIST.SHUCFIXES].data;
  }

  public run(msg: Discord.Message): boolean {
    if (msg.author.id === this.shucID) {
      const prefix = this.fetchRandomName();
      const nickname = prefix.length < 25 ? `${prefix} | ShuC` : `${prefix}|ShuC`;
      msg.member.setNickname(nickname, "ShuCFixing");
    }
    return false;
  }

  private fetchRandomName(): string {
    return this.list[Math.floor(Math.random() * this.list.length)].key;
  }
}
