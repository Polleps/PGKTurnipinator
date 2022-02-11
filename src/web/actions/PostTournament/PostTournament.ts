import Config from "../../../Config";
import { sClient } from "../../../Context";
import ITournament from "../../../models/ITournament";
import { store } from "../../../Store";
import { TournamentStoreCache } from "../../../stores";
import { IUserInfo } from "../../discord.agent";
import { IAction, Performer } from "../IAction";

import { postEmbed } from "./postEmbed";
import { scheduleEvent } from "./scheduleEvent";

const guildID = Config.GUILD_ID;
const roleName = Config.POST_TOURNAMENT_ROLE_NAME;

const cache = store.cache("tournaments") as TournamentStoreCache;

/**
 * Perform 'posttournament' action.
 * TO's fill in details about tournament and the tournament gets posted in the discord channels and the online agenda.
 * @param userInfo OATH User info.
 * @param action action parameters.
 */
export const postTournament: Performer = async (userInfo: IUserInfo, action: IAction): Promise<string> => {
  const client = sClient.client;
  const guild = await client.guilds.fetch(guildID);

  if (!userInfo.id) {
    throw new Error('Session expired, please re-login and try again.');
  }

  const user = await guild.members.fetch(userInfo.id);

  await guild.roles.fetch();
  const role = guild.roles.cache.find((x) => x.name === roleName);

  if (!action.args || action.args.length < 1) {
    throw new Error("Invalid Action.");
  }

  if (!user) {
    throw new Error("You're not in the Discord.");
  }

  if (!user.roles.cache.has(role.id)) {
    throw new Error("You are not allowed to post tournaments.");
  }

  try {
    const parsedTournament = JSON.parse(action.args[0]) as ITournament;
    const existingTournament = cache.getByID(parsedTournament.id);

    if (existingTournament) {
      parsedTournament.messageID = existingTournament.messageID;
      parsedTournament.guildEventID = existingTournament.guildEventID;
    }

    if (action.args[ 1 ] !== "saveonly") {
      const messageID = await postEmbed(guild, user, parsedTournament);
      const guildEventID = await scheduleEvent(guild, parsedTournament);

      parsedTournament.messageID = messageID;
      parsedTournament.guildEventID = guildEventID;
    }

    storeTournament(parsedTournament);
  } catch (err) {
    console.log(err);
    throw new Error("Invalid Tournament Details.");
  }

  return "Done";
};

/**
 * Stores a tournament in the database.
 * @param t tournament details to be inserted in the Object store.
 */
const storeTournament = (t: ITournament) => {
  cache.add(t);
};
