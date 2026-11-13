import Config from "../../../Config";
import { sClient } from "../../../Context";
import { normalizeTournament } from "../../../db/normalizeTournament";
import { store } from "../../../Store";
import { IUserInfo } from "../../discord.agent";
import { IAction, Performer } from "../IAction";

import { postEmbed } from "./postEmbed";
import { scheduleEvent } from "./scheduleEvent";

const guildID = Config.GUILD_ID;
const roleName = Config.POST_TOURNAMENT_ROLE_NAME;

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

  if (!user.roles.cache.has(role!.id)) {
    throw new Error("You are not allowed to post tournaments.");
  }

  // The same normalizer as the import: e.g. online tournaments arrive with null location
  // fields, and start.gg ids as numbers.
  let parsed: unknown;
  try {
    parsed = JSON.parse(action.args[0]);
  } catch {
    throw new Error("Invalid Tournament Details.");
  }
  const normalized = normalizeTournament(parsed);
  if (!normalized.ok) {
    console.log(`Rejected tournament: ${normalized.reason}`);
    throw new Error("Invalid Tournament Details.");
  }
  const tournament = normalized.row;

  try {
    const existing = store.tournaments.getById(tournament.id);
    // Never taken from the form: the Discord ids come from the stored row, and pr is set elsewhere.
    tournament.messageID = existing?.messageID ?? null;
    tournament.guildEventID = existing?.guildEventID ?? null;
    tournament.pr = existing?.pr ?? false;

    if (action.args[1] !== "saveonly") {
      tournament.messageID = await postEmbed(guild, user, tournament);

      // The normalizer stores a stream only with both a URL and a start time.
      if (tournament.streamURL !== null && tournament.streamStartDate !== null) {
        tournament.guildEventID = await scheduleEvent(guild, tournament);
      }
    }

    // An existing id updates its row; a new id is a new row, even if its url is reused.
    store.tournaments.upsert(tournament);
  } catch (err) {
    console.log(err);
    throw new Error("Invalid Tournament Details.");
  }

  return "Done";
};
