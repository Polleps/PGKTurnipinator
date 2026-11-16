import Config from "../../../Config";
import { sClient } from "../../../Context";
import { normalizeTournament } from "../../../db/normalizeTournament";
import { store } from "../../../Store";
import { IUserInfo } from "../../discord.agent";
import { ActionError } from "../ActionError";
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
  // Validate before touching Discord, so a bad post is answered with a clear 400.
  const tournament = parseTournament(action);

  const client = sClient.client;
  const guild = await client.guilds.fetch(guildID);

  if (!userInfo.id) {
    throw new Error("Session expired, please re-login and try again.");
  }

  const user = await guild.members.fetch(userInfo.id);

  await guild.roles.fetch();
  const role = guild.roles.cache.find((x) => x.name === roleName);

  if (!user) {
    throw new Error("You're not in the Discord.");
  }

  if (!user.roles.cache.has(role!.id)) {
    throw new Error("You are not allowed to post tournaments.");
  }

  try {
    const existing = store.tournaments.getById(tournament.id);
    // Never taken from the form: the Discord ids come from the stored row, and pr is set elsewhere.
    tournament.messageID = existing?.messageID ?? null;
    tournament.guildEventID = existing?.guildEventID ?? null;
    tournament.pr = existing?.pr ?? false;

    if (action.args?.[1] !== "saveonly") {
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

export const MISSING_START_GG_ID =
  "This tournament has no start.gg id. Fill in its start.gg link and load the details from start.gg before posting.";

/**
 * Parses the form's JSON with the same normalizer as the import: e.g. online tournaments
 * arrive with null location fields, and start.gg ids as numbers.
 */
export const parseTournament = (action: IAction) => {
  if (!action.args || action.args.length < 1) {
    throw new ActionError("Invalid Action.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(action.args[0]);
  } catch {
    throw new ActionError("Invalid Tournament Details.");
  }
  const normalized = normalizeTournament(parsed);
  if (!normalized.ok) {
    console.log(`Rejected tournament: ${normalized.reason}`);
    throw new ActionError(normalized.badId ? MISSING_START_GG_ID : `Invalid Tournament Details: ${normalized.reason}.`);
  }
  return normalized.row;
};
