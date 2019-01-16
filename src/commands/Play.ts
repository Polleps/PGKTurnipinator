import * as Discord from "discord.js";
import { validateID, validateURL } from "ytdl-core";
import { Command } from "./Command";
import { sYoutubeStreamer } from "../voice/YoutubeStreamer";

export class PlayCommand extends Command {
  constructor() {
    super();
    this._tag = "play";
    this._usage = `\`${this._prefix}play [Youtube ID or Youtube URL]\``;
    // tslint:disable-next-line:max-line-length
    this._description = "Plays a youtube video in the voicechat, If a video is already playing use this command to add one to the queue.";
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    if (!args) {
      this.sendUsage(message);
      return true;
    }

    if (!message.member.voiceChannel) {
      message.reply("You are not in a voicechannel.");
      return true;
    }

    if (!(validateID(args[0]) || validateURL(args[0]))) {
      this.sendUsage(message);
      return true;
    }

    sYoutubeStreamer.play(message, args[0]);

    return true;
  }
}
