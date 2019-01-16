import { prop, Typegoose } from "typegoose";
import Config from "../Config";

export class AccountRef extends Typegoose {
  @prop({ required: true, unique: true })
  public refLink: string;

  @prop({ required: true })
  public discordID: string;

  @prop({ required: true, default: Date.now() })
  public createdAt: Date;

  @prop()
  public get expired(): boolean {
    return (Date.now() - this.createdAt.getTime()) > Config.AccountRefExpireTime;
  }
}
