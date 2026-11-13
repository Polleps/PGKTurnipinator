import { Message } from "discord.js";
import { ITrigger, NeeTrigger } from "./triggers";
export default class TriggerController {
  private triggers: ITrigger[] = new Array<ITrigger>(
    new NeeTrigger(),
  );

  public runTriggers(msg: Message): boolean {
    for (const trigger of this.triggers) {
      if (trigger.run(msg)) {
        return true;
      }
    }
    return false;
  }
}
