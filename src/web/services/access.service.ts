import { IUserInfo } from "../discord.agent";
import { sClient } from "../../Context";
import Config from "../../Config";

export const userCanFetchTournament = async (userInfo: IUserInfo) => {
  if (!userInfo?.id) {
    return false;
  }

  const guildID = Config.GUILD_ID;
  const roleID = Config.POST_TOURNAMENT_ROLE_ID;
  const client = sClient.client;
  const guild = client.guilds.cache.get(guildID)!;
  const user = await guild.members.fetch(userInfo.id);

  if (!user) {
    return false;
  }

  if (!user.roles.cache.has(roleID)) {
    return false;
  }

  return true;
};
