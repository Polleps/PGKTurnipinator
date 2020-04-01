import * as Discord from "discord.js";

import { ITrigger } from "./ITrigger";
import Config from "../Config";

export class RainbowTrigger implements ITrigger {

  public run(message: Discord.Message): boolean {
    if (message.guild.id !== Config.GUILD_ID) {
      return false;
    }
    const role = message.guild.roles.get(Config.COLOR_ROLE_ID);
    role.setColor(randomColor());
  }
}

const randomColor = () => {
  const randomNum = () => Math.round(Math.random() * 255);
  return `#${rgbToHex(randomNum())}${rgbToHex(randomNum())}${rgbToHex(randomNum())}`;
};

const rgbToHex = (rgb) => {
  let hex = Number(rgb).toString(16);
  if (hex.length < 2) {
       hex = "0" + hex;
  }
  return hex;
};
