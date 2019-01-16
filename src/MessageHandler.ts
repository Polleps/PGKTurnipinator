import * as Discord from "discord.js";
import CommandController from "./CommandController";
import { sClient } from "./Context";
import TriggerController from "./TriggerController";

export default class MessageHandler {
  private tiggerController: TriggerController;
  private commandController: CommandController;
  constructor() {
    this.tiggerController = new TriggerController();
    this.commandController = new CommandController();
  }

  public processMessage(message: Discord.Message): void {
    // Message should not be processed if it was posted by the bot.
    if (message.author.id === sClient.client.user.id) {
      return;
    }
    // Commands should not be excecuted if one of the triggers returns true.
    if (!this.tiggerController.runTriggers(message)) {
      this.commandController.processMessage(message);
    }
  }
}
