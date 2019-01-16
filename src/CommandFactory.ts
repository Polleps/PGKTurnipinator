import {
  Command,
  FixbotCommand,
  JoinCommand,
  PingCommand,
  LeaveCommand,
  RegisterCommand,
} from "./commands";

export default class CommandFactory {

  public static commandList: string[] = [
    "ping",
    "fixbot",
    "join",
    "leave",
    "register",
  ];

  public createCommand(tag: string): Command {
    switch (tag) {
      case "ping":
        return new PingCommand();
      case "fixbot":
        return new FixbotCommand();
      case "join":
        return new JoinCommand();
      case "leave":
        return new LeaveCommand();
      case "register":
        return new RegisterCommand();
      default:
        throw new Error("Command Does not exist");
    }
  }
}
