import { Performer, IAction } from "../actions/IAction";
import { flair, postTournament } from "../actions";
import { IUserInfo } from "../discord.agent";

export default class ActionService {
  private actions: Map<string, Performer>;

  constructor() {
    this.actions = new Map<string, Performer>();
    this.actions.set("flair", flair);
    this.actions.set("posttournament", postTournament);
  }

  public run(userInfo: IUserInfo, action: IAction): string {
    if (this.actions.has(action.name)) {
      return this.actions.get(action.name)(userInfo, action);
    } else {
      return "Invalid action";
    }
  }
}
