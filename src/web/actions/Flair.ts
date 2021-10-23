import { sClient } from "../../Context";
import { IUserInfo } from "../discord.agent";
import { Role, GuildMember } from "discord.js";
import { IAction, Performer } from "./IAction";
import Config from "../../Config";
import { createLogger } from "../../utils/logger";
import { store } from "../../Store";
import { JoinableRoleCache } from "../../stores";
const log = createLogger("Flair Action");
const PGK = Config.GUILD_ID;
const roleCache = store.cache("joinableroles") as JoinableRoleCache;
export const flair: Performer = async (userInfo: IUserInfo, action: IAction) => {
  if (!action.args || action.args.length < 2) {
    return "No role was specified.";
  }

  const mod = action.args[0];
  const roleName = decodeURIComponent(action.args[1]);
  if (!roleCache.has(roleName)) {
    return "Role not found.";
  }

  const client = sClient.client;
  const guild = await client.guilds.fetch(PGK);
  // console.log("Guild", guild);
  const user = await guild.members.fetch(userInfo.id);
  const role = guild.roles.cache.find((x) => x.name === roleName);

  if (!user || !role) {
    console.log("User", user.displayName);
    console.log("Role", role);
    return "Invalid arguments.";
  }

  if (mod === "add") {
    return addRole(user, role);
  } else if (mod === "remove") {
    return removeRole(user, role);
  }
};

const addRole = (user: GuildMember, role: Role): string => {
  if (!user.roles.cache.has(role.id)) {
    user.roles.add(role);
    return `Added role: ${role.name}`;
  }
  return "You already have this role.";
};

const removeRole = (user: GuildMember, role: Role): string => {
  if (user.roles.cache.has(role.id)) {
    user.roles.remove(role);
    return `Removed role: ${role.name}`;
  }
  return "You don't have this role.";
};
