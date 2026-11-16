import {
  Guild,
  GuildScheduledEventCreateOptions,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";

import ITournament from "../../../models/ITournament";

const buildTitle = (name: string) => `Kijk ${name} live op Twitch!`;

const buildDescription = (url: string) => `Bracket en meer info is te vinden op https://start.gg/tournament/${url}`;

export const buildEvent = (tournament: ITournament): GuildScheduledEventCreateOptions => ({
  name: buildTitle(tournament.title),
  scheduledStartTime: tournament.streamStartDate!,
  scheduledEndTime: tournament.endDate,
  privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
  entityType: GuildScheduledEventEntityType.External,
  description: buildDescription(tournament.url),
  entityMetadata: {
    location: tournament.streamURL ?? undefined,
  },
});

const postEvent = async (guild: Guild, event: GuildScheduledEventCreateOptions): Promise<string> => {
  const createdEvent = await guild.scheduledEvents.create(event);

  return createdEvent.id;
};

const editExistingEvent = async (
  guild: Guild,
  eventID: string,
  eventOptions: GuildScheduledEventCreateOptions,
): Promise<string> => {
  try {
    const event = await guild.scheduledEvents.fetch(eventID);
    event.edit(eventOptions);
  } catch (e) {
    console.error(e);

    return postEvent(guild, eventOptions);
  }

  return eventID;
};

/**
 * Schedule a new event for a tournament or edits an existing one.
 * @param client Discord.js Client
 * @param tournamentDetails The tournament to schedule
 * @returns The ID of the scheduled event
 */
export const scheduleEvent = async (guild: Guild, tournamentDetails: ITournament): Promise<string> => {
  const eventOptions = buildEvent(tournamentDetails);

  if (tournamentDetails.guildEventID) {
    return editExistingEvent(guild, tournamentDetails.guildEventID, eventOptions);
  }

  return postEvent(guild, eventOptions);
};
