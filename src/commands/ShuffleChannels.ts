import * as Discord from "discord.js";
import { Command } from "./Command";
import { createCipher } from "crypto";

export class ShuffleChannelsCommand extends Command {
  constructor() {
    super();
    this._tag = "shufflechannels";
    this._usage = `Type \`${this._prefix}ping\``;
    this._description = "It's just ping";
    this._isPublic = false;
    this._isAdminCommand = true;
  }

  public run(message: Discord.Message, args?: string[]): boolean {
    console.log(message.guild.channels.filter((c) => c.type === "category").map((c) => c.position).join(", "));
    const categoryChannels = message.guild.channels.filter((c) => c.type === "category" && c.name !== "adminning");
    const categoryNames = categoryChannels.map((c) => c.name);
    const picker = randomPicker<string>(categoryNames);
    categoryChannels.forEach((c) => c.setName(picker.next().value));
    const max = message.guild.channels.map((c) => c.position).sort((a, b) => b - a)[0];
    console.log(max);
    const channels = message.guild.channels;
    randomize([...channels.values()], max).then(() => console.log("Done"));
    return true;
  }
}

async function randomize(channels: Discord.GuildChannel[], max: number) {
  for (const c of channels) {
    await throttledRun(() => {
      c.setPosition(Math.floor((Math.random() * max * 2) - max), true);
    }, 500);
  }
  return;
}

function* randomPicker<T>(arr: T[]) {
  while (arr.length > 0) {
    yield arr.splice(Math.floor((Math.random() * arr.length)), 1)[0];
  }
}

function throttledRun(func: () => void, time): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      func();
      resolve();
    }, time);
  });
}
