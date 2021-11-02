import { IUserInfo } from "../discord.agent";
import { sClient } from "../../Context";
import Config from "../../Config";

export const userCanFetchTournament = async (userInfo: IUserInfo) => {
  const guildID = Config.GUILD_ID;
  const roleName = Config.POST_TOURNAMENT_ROLE_NAME;
  const client = sClient.client;
  const guild = client.guilds.cache.get(guildID);
  const user = await guild.members.fetch(userInfo.id);
  await guild.roles.fetch();
  const role = guild.roles.cache.find((x) => x.name === roleName);

  if (!user) {
    return false;
  }

  await user.roles.fetch();

  if (!user.roles.cache.has(role.id)) {
    return false;
  }

  return true;
};
