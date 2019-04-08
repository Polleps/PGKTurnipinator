import { sClient, sList } from "../../Context";
import { LIST } from "../../ListLoader";
import { IUserInfo } from "../discord.agent";
import { Role, GuildMember } from "discord.js";
import { IAction, Performer } from "./IAction";
import Config from "../../Config";
const PGK = Config.GUILD_ID;

export const flair: Performer = (userInfo: IUserInfo, action: IAction) => {
  if (!action.args || action.args.length < 2) {
    return "No role was specified.";
  }

  const mod = action.args[0];
  const roleName = decodeURIComponent(action.args[1]);

  const roles = sList.lists[LIST.JOINABLEROLES].data.map(((x) => `${x.key}`));

  if (!roles.find((x) => x === roleName)) {
    return "Role does not exist or can not be flaired.";
  }

  const client = sClient.client;
  const guild = client.guilds.get(PGK);
  const user = guild.members.get(userInfo.id);
  const role = guild.roles.find((x) => x.name === roleName);

  if (!user || !role) {
    return "Invalid arguments.";
  }

  if (mod === "add") {
    return addRole(user, role);
  } else if (mod === "remove") {
    return removeRole(user, role);
  }
};

const addRole = (user: GuildMember, role: Role): string => {
  if (!user.roles.has(role.id)) {
    user.addRole(role);
    return `Added role: ${role.name}`;
  }
  return "You already have this role.";
};

const removeRole = (user: GuildMember, role: Role): string => {
  if (user.roles.has(role.id)) {
    user.removeRole(role);
    return `Removed role: ${role.name}`;
  }
  return "You don't have this role.";
};
