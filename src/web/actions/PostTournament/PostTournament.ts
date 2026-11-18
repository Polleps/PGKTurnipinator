import type { Guild, GuildMember } from "discord.js";

import Config from "../../../Config";
import { sClient } from "../../../Context";
import { type NormalizedTournament, normalizeTournament } from "../../../db/normalizeTournament";
import { store } from "../../../Store";
import { IUserInfo } from "../../discord.agent";
import { ActionError } from "../ActionError";
import { IAction, Performer } from "../IAction";

import { postEmbed } from "./postEmbed";
import { scheduleEvent } from "./scheduleEvent";

const guildID = Config.GUILD_ID;
const roleID = Config.POST_TOURNAMENT_ROLE_ID;

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

  if (!user) {
    throw new Error("You're not in the Discord.");
  }

  if (!user.roles.cache.has(roleID)) {
    throw new Error("You are not allowed to post tournaments.");
  }

  return withTournamentLock(tournament.id, () =>
    postOrUpdate(guild, user, tournament, action.args?.[1] === "saveonly"),
  );
};

export const EVENT_FAILED =
  "Tournament posted, but its Discord event for the stream could not be created or updated. Post again to retry the event.";

/**
 * Posts (or edits) the agenda message and the stream event, and stores the tournament. The
 * message id is stored as soon as the message is sent, so a failure after that (e.g. the event)
 * can't lose it: posting again edits that message instead of sending another one.
 */
const postOrUpdate = async (
  guild: Guild,
  user: GuildMember,
  tournament: NormalizedTournament,
  saveOnly: boolean,
): Promise<string> => {
  try {
    const existing = store.tournaments.getById(tournament.id);
    // Never taken from the form: the Discord ids come from the stored row, and pr is set elsewhere.
    tournament.messageID = existing?.messageID ?? null;
    tournament.guildEventID = existing?.guildEventID ?? null;
    tournament.pr = existing?.pr ?? false;

    if (!saveOnly) {
      tournament.messageID = await postEmbed(guild, user, tournament);
    }

    // An existing id updates its row; a new id is a new row, even if its url is reused.
    store.tournaments.upsert(tournament);
  } catch (err) {
    console.log(err);
    throw new Error("Invalid Tournament Details.");
  }

  // The normalizer stores a stream only with both a URL and a start time.
  if (saveOnly || tournament.streamURL === null || tournament.streamStartDate === null) {
    return "Done";
  }

  try {
    tournament.guildEventID = await scheduleEvent(guild, tournament);
    store.tournaments.upsert(tournament);
  } catch (err) {
    console.error(`Could not schedule the stream event of tournament ${tournament.id}.`, err);
    return EVENT_FAILED;
  }

  return "Done";
};

// Posts of the same tournament run one after another (the bot is a single process), so a second
// click waits for the first post's message id and then edits that message instead of sending one.
const tournamentLocks = new Map<string, Promise<unknown>>();

/** Runs `run` after any earlier run for the same tournament id has settled. */
export const withTournamentLock = async <T>(id: string, run: () => Promise<T>): Promise<T> => {
  const previous = tournamentLocks.get(id) ?? Promise.resolve();
  const current = previous.then(run);
  // The tail never rejects, so a failed post doesn't fail the next one.
  const tail = current.catch(() => {});
  tournamentLocks.set(id, tail);
  try {
    return await current;
  } finally {
    // The last post of a tournament removes its entry, so the map doesn't grow.
    if (tournamentLocks.get(id) === tail) {
      tournamentLocks.delete(id);
    }
  }
};

/** How many tournaments have a post running or waiting (for tests). */
export const pendingTournamentLocks = (): number => tournamentLocks.size;

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
