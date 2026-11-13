import {
  Command,
  FixbotCommand,
  PingCommand,
  PostFlairTextCommand,
  ReloadTournamentCacheCommand,
} from "./commands";

export default class CommandFactory {
  private commands: Map<string, () => Command>;

  constructor() {
    this.commands = new Map<string, () => Command>([
      ["ping", () => new PingCommand()],
      ["fixbot", () => new FixbotCommand()],
      ["postflairtext", () => new PostFlairTextCommand()],
      ["reloadcache", () => new ReloadTournamentCacheCommand()],
    ]);
  }

  public get commandList() {
    return this.commands.keys();
  }

  public createCommand(tag: string): Command {
    if (this.commands.has(tag)) {
      return this.commands.get(tag)!();
    }

    throw new Error("Command does not exist");
  }
}
