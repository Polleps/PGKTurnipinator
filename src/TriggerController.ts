import * as Discord from "discord.js";
import {
  ITrigger,
  ShucfixTrigger,
  RadioTrigger,
  RainbowTrigger,
  NeeTrigger,
} from "./triggers";
export default class TriggerController {
  private triggers: ITrigger[] = new Array<ITrigger>(
    new NeeTrigger(),
    new ShucfixTrigger(),
    new RadioTrigger(),
    // new RainbowTrigger(),
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
