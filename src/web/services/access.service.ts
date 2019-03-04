import { IUserInfo } from "../discord.agent";
import { sClient } from "../../Context";
import Config from "../../Config";

export const userCanFetchTournament = (userInfo: IUserInfo) => {
  const guildID = Config.GUILD_ID;
  const roleName = Config.POST_TOURNAMENT_ROLE_NAME;
  const client = sClient.client;
  const guild = client.guilds.get(guildID);
  const user = guild.members.get(userInfo.id);
  const role = guild.roles.find((x) => x.name === roleName);

  if (!user) {
    return false;
  }

  if (!user.roles.has(role.id)) {
    return false;
  }

  return true;
};
