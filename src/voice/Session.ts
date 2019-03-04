import * as Discord from "discord.js";
import * as ytdl from "ytdl-core";

export default class Session {
  private voiceChannel: Discord.VoiceChannel;
  private connection: Discord.VoiceConnection;
  private msgChannel: Discord.TextChannel;
  private queue: IQueueItem[];
  private volume: number = 0.1;
  private events: ISessionEvent[] = [];
  private stopDispatch: () => void;

  constructor(voiceChannel: Discord.VoiceChannel, textChannel: Discord.TextChannel) {
    this.voiceChannel = voiceChannel;
    this.msgChannel = textChannel;
    this.queue = [];
    this.stopDispatch = () => {
      return;
    };
  }

  public addVideo(displayName: string, url: string): void {
    this.queue.push({ displayName, url });
  }

  public async start() {
    await this.connect();
    this.playVideo();
  }

  public stopCurrentVideo() {
    this.stopDispatch();
  }

  public on(name: SessionEventName, func: () => void) {
    this.events.push({ name, func });
  }

  private async connect() {
    this.connection = await this.voiceChannel.join();
    return;
  }

  private playVideo() {
    const video = this.queue.shift();
    const stream = ytdl(video.url, { filter: "audioonly", quality: "highestaudio" });
    stream.on("info", (info) => this.printInfo(info, video.displayName));
    stream.on("error", (err) => {
      console.error(err);
    });
    const dispatcher = this.connection.playStream(stream, { seek: 0, volume: this.volume });
    dispatcher.on("end", () => {
      if (this.queue.length !== 0) {
        this.playVideo();
      } else {
        this.voiceChannel.leave();
        this.emit("end");
      }
    });
    this.stopCurrentVideo = () => dispatcher.end();
  }

  private async emit(name: SessionEventName) {
    const event = this.events.find((x: ISessionEvent) => x.name === name);
    if (event) {
      event.func();
    }
    return;
  }

  private async printInfo(info: ytdl.videoInfo, displayName: string) {
    const embed = new Discord.RichEmbed()
      .setColor("#ff1919")
      .setAuthor(info.author.name || "#", info.author.avatar || "#", info.author.channel_url || "#")
      .addField("Playing", `[${info.title || "No Title Found"}](${info.video_url || "#"})`)
      .addField("Duration", formatLength(+info.length_seconds))
      .setFooter(`Requested by: ${displayName}`);

    try {
      embed.setThumbnail(info.thumbnail_url);
    } catch (err) {
      console.error(err);
    }

    this.msgChannel.send(embed);
    return;
  }
}

interface IQueueItem {
  displayName: string;
  url: string;
}
type SessionEventName = "end";

interface ISessionEvent {
  name: SessionEventName;
  func: () => void;
}

const formatLength = (l: number): string => {
  const sL = (l / 60).toFixed(2);
  const splitLength = sL.split(".");
  return splitLength.map((x) => padZero(x)).join(":");
};

const padZero = (x: string | number): string => {
  return `${x}`.length < 2 ? `0${x}` : `${x}`;
};
