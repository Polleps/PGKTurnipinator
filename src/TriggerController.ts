import * as Discord from "discord.js";
import { BannedWordsTrigger, ITrigger } from "./triggers";
export default class TriggerController {
  private triggers: ITrigger[] = new Array<ITrigger>(
    new BannedWordsTrigger(),
  );

  public runTriggers(msg: Discord.Message): boolean {
    for (const trigger of this.triggers) {
      if (trigger.run(msg)) {
        return true;
      }
    }
    return false;
  }
}
