import {
  Command,
  FixbotCommand,
  PingCommand,
  ShucfixCommand,
  PostFlairTextCommand,
  ShucfixManageCommand,
  SeedDBCommand,
} from "./commands";

export default class CommandFactory {

  private commands: Map<string, () => Command>;

  constructor() {
    this.commands = new Map<string, () => Command>([
      ["ping", () => new PingCommand()],
      ["fixbot", () => new FixbotCommand()],
      ["shucfix", () => new ShucfixCommand()],
      ["shucfix-manage", () => new ShucfixManageCommand()],
      ["postflairtext", () => new PostFlairTextCommand()],
      // ["seeddb", () => new SeedDBCommand()],
    ]);
  }

  public get commandList() {
    return this.commands.keys();
  }

  public createCommand(tag: string): Command {
    if (this.commands.has(tag)) {
      return this.commands.get(tag)();
    }

    throw new Error("Command does not exist");
  }
}
