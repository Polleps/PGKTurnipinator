import * as Discord from "discord.js";
import { validateID, validateURL } from "ytdl-core";

import { ITrigger } from "./ITrigger";
import { sYoutubeStreamer } from "../voice/YoutubeStreamer";
import Config from "../Config";

export class RadioTrigger implements ITrigger {

  public run(message: Discord.Message): boolean {
    if (message.channel.id !== Config.BOT_CHANNEL_ID) {
      return false;
    }

    if (!message.member.voiceChannel) {
      return false;
    }

    if (!(validateID(message.content) || validateURL(message.content))) {
      return false;
    }

    sYoutubeStreamer.play(message, message.content);
    message.delete().catch((error) => console.error(error));
    return true;
  }
}
