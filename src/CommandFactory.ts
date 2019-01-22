import {
  Command,
  FixbotCommand,
  JoinCommand,
  PingCommand,
  LeaveCommand,
  RegisterCommand,
  PlayCommand,
  StopCommand,
  ShucfixCommand,
} from "./commands";

export default class CommandFactory {

  private commands: Map<string, () => Command>;

  constructor() {
    this.commands = new Map<string, () => Command>([
      ["ping", () => new PingCommand()],
      ["fixbot", () => new FixbotCommand()],
      ["join", () => new JoinCommand()],
      ["leave", () => new LeaveCommand()],
      ["register", () => new RegisterCommand()],
      ["play", () => new PlayCommand()],
      ["stop", () => new StopCommand()],
      ["skip", () => new StopCommand()],
      ["shucfix", () => new ShucfixCommand()],
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
