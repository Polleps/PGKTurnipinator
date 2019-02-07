import { sClient, sList } from "../../Context";
import { LIST } from "../../ListLoader";
import { IUserInfo } from "../discord.agent";
import { Role, GuildMember } from "discord.js";
const PGK = "185043146147627009";

export const flair = (userInfo: IUserInfo, mod: string, roleName: string) => {
  const roles = sList.lists[LIST.JOINABLEROLES].data.map(((x) => `${x.key}`));

  if (!roles.find((x) => x === roleName)) {
    return;
  }

  const client = sClient.client;
  const guild = client.guilds.get(PGK);
  const user = guild.members.get(userInfo.id);
  const role = guild.roles.find((x) => x.name === roleName);

  if (!user || !role) {
    return;
  }

  if (mod === "add") {
    addRole(user, role);
  } else if (mod === "remove") {
    removeRole(user, role);
  }
};

const addRole = (user: GuildMember, role: Role) => {
  if (!user.roles.has(role.id)) {
    user.addRole(role);
  }
};

const removeRole = (user: GuildMember, role: Role) => {
  if (user.roles.has(role.id)) {
    user.removeRole(role);
  }
};
