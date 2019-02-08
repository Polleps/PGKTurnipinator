import { IUserInfo } from "../discord.agent";

export interface IAction {
  name: string;
  args?: string[];
}

export type Performer = (userInfo: IUserInfo, action: IAction) => string;
