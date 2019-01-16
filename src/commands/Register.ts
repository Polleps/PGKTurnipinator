import * as Discord from "discord.js";
import { Command } from "./Command";
import { User, AccountRef } from "../models";
import * as uuid from "uuid/v1";

export class RegisterCommand extends Command {
  constructor() {
    super();
    this._tag = "register";
    // this._usage = `Type \`${this._prefix}ping\``;
    this._description = "Use this to create a new PGK Account!";
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    const userID = message.author.id;
    const UserModel = new User().getModelForClass(User);
    UserModel.findOne({ discordID: userID }).exec().then((value: InstanceType<typeof UserModel>) => {
      if (value) {
        message.reply("You already have an account.").then((msg: Discord.Message) => msg.delete(10000));
      } else {
        this.createNewRef(message);
      }
    }).catch((err) => console.log(err));
    return true;
  }

  private createNewRef(message: Discord.Message): void {
    const userID = message.author.id;
    const ref: string = uuid();
    const AccountRefModel = new AccountRef().getModelForClass(AccountRef);
    const accountRef = new AccountRefModel({ refLink: ref, discordID: userID });
    accountRef.save().then().catch((err) => console.log(err));
  }
}
