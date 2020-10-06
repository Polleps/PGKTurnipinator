import * as Discord from "discord.js";
import * as ytdl from "ytdl-core";
import ytdlDiscord from "ytdl-core-discord";
import * as moment from "moment";

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

  public addVideo(url: string, author: Discord.GuildMember): void {
    this.queue.push({ displayName: author.displayName, url, userIcon: author.user.avatarURL });
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

  private async playVideo() {
    const video = this.queue.shift();
    const stream = await ytdlDiscord(video.url, { filter: "audioonly", quality: "highestaudio" });
    // stream.on("info", (info) => this.printInfo(info, video.displayName));
    ytdl.getInfo(video.url).then((info) => this.printInfo(info, video.displayName, video.userIcon));
    stream.on("error", (err) => {
      console.error(err);
    });

    const dispatcher = this.connection.playOpusStream(stream, { seek: 0, volume: this.volume });

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

  private async printInfo(info: ytdl.videoInfo, displayName: string, userIcon: string) {
    let image = "#";
    try {
      image = info.player_response.videoDetails.thumbnail.thumbnails.pop().url;
    } catch (e) {
      console.error(e);
    }

    const embed = new Discord.RichEmbed()
      .setColor("#ff1919")
      .setAuthor(info.author.name || "#", info.author.avatar || "#", info.author.channel_url || "#")
      .addField("Playing", `[${info.title || "No Title Found"}](${info.video_url || "#"})`)
      .addField("Duration", formatLength(+info.length_seconds))
      .setFooter(`Requested by: ${displayName}`, userIcon)
      .setThumbnail(image);

    this.msgChannel.send(embed);
    return;
  }
}

interface IQueueItem {
  displayName: string;
  userIcon: string;
  url: string;
}
type SessionEventName = "end";

interface ISessionEvent {
  name: SessionEventName;
  func: () => void;
}

const formatLength = (l: number): string => {
  if (!l) {
    return "Duration Not Found";
  }
  const duration = moment.duration(l, "seconds");
  const hours = duration.hours();
  const minutes = duration.minutes();
  const seconds = duration.seconds();
  return `${hours ? `${padZero(hours)}:` : ""}${padZero(minutes)}:${padZero(seconds)}`;
};

const padZero = (x: string | number): string => {
  return `${x}`.length < 2 ? `0${x}` : `${x}`;
};
