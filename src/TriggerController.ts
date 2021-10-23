import { Message } from "discord.js";
import {
  ITrigger,
  ShucfixTrigger,
  RainbowTrigger,
  NeeTrigger,
} from "./triggers";
export default class TriggerController {
  private triggers: ITrigger[] = new Array<ITrigger>(
    new NeeTrigger(),
    new ShucfixTrigger(),
    // new RainbowTrigger(),
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
