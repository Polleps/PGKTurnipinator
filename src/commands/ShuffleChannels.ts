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
    message.reply("Command is disabled.");
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
