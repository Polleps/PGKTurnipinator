import Session from "./Session";
import { Message, TextChannel } from "discord.js";

class YoutubeStreamer {
  private static instance: YoutubeStreamer;

  public static get Instance(): YoutubeStreamer {
    return this.instance || (this.instance = new this());
  }

  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map<string, Session>();
  }

  public play(message: Message, url: string) {
    const guildID = message.guild.id;
    const member = message.member;
    if (this.sessions.has(guildID)) {
      const session = this.sessions.get(guildID);
      session.addVideo(url, member);
    } else {
      const session = new Session(message.member.voiceChannel, message.channel as TextChannel);
      this.sessions.set(guildID, session);
      session.addVideo(url, member);
      session.start();
      session.on("end", () => this.sessions.delete(guildID));
    }
  }

  public stop(message: Message): void {
    const guildID = message.guild.id;
    if (this.sessions.has(guildID)) {
      this.sessions.get(guildID).stopCurrentVideo();
    }
  }
}

export const sYoutubeStreamer = YoutubeStreamer.Instance;
