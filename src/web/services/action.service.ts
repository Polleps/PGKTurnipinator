import { Performer, IAction } from "../actions/IAction";
import { postTournament } from "../actions";
import { IUserInfo } from "../discord.agent";

export default class ActionService {
  private actions: Map<string, Performer>;

  constructor() {
    this.actions = new Map<string, Performer>();
    this.actions.set("posttournament", postTournament);
  }

  public async run(userInfo: IUserInfo, action: IAction): Promise<string> {
    if (this.actions.has(action.name)) {
      return this.actions.get(action.name)(userInfo, action);
    } else {
      return "Invalid action";
    }
  }
}
