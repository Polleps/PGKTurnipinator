import { prop, Typegoose } from "typegoose";

export class User extends Typegoose {
  @prop({ required: true })
  public username: string;

  @prop({ required: true })
  public password: string;

  @prop({ required: true, unique: true })
  public discordID: string;

}
