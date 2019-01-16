import * as Discord from "discord.js";
import { Command } from "./Command";
import { sYoutubeStreamer } from "../voice/YoutubeStreamer";

export class StopCommand extends Command {
  constructor() {
    super();
    this._tag = "stop";
    this._usage = `\`${this._prefix}stop\``;
    this._description = "Stops current video and skips to the next one if there are any.";
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!message.member.voiceChannel) {
      message.reply("You are not in a voicechannel.");
      return true;
    }

    sYoutubeStreamer.stop(message);

    return true;
  }
}
