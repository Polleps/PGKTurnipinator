import {
  Guild,
  GuildScheduledEvent,
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

const IMAGE_TIMEOUT_MS = 10_000;
// Discord's image upload limit is larger, but cover images this big are never needed.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/**
 * Downloads the tournament thumbnail (the same `image` the embed and agenda use) as a data URI
 * for the event cover. discord.js would fetch a URL itself, but without a timeout and always
 * labelled as JPEG, so it is fetched here. Never throws: any problem is logged and gives null,
 * so the event is posted without a cover.
 */
export const fetchEventImage = async (
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = IMAGE_TIMEOUT_MS,
): Promise<string | null> => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  try {
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new Error("not an http(s) URL");
    }
    const res = await fetchImpl(trimmed, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!IMAGE_TYPES.has(contentType)) {
      throw new Error(`unsupported content type "${contentType}"`);
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
      throw new Error("image too large");
    }
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
      throw new Error(`image size ${data.length} bytes is out of range`);
    }
    return `data:${contentType};base64,${data.toString("base64")}`;
  } catch (e) {
    console.error(`Could not load event cover image ${trimmed}; the event is posted without one.`, e);
    return null;
  }
};

/** Runs `run` with the cover image; if that fails, logs it and runs it once more without one. */
const withImageFallback = async <T>(image: string | null, run: (image?: string) => Promise<T>): Promise<T> => {
  if (image) {
    try {
      return await run(image);
    } catch (e) {
      console.error("Discord rejected the event with a cover image; retrying without it.", e);
    }
  }
  return run();
};

const postEvent = async (
  guild: Guild,
  event: GuildScheduledEventCreateOptions,
  image: string | null,
): Promise<string> => {
  const createdEvent = await withImageFallback(image, (img) => guild.scheduledEvents.create({ ...event, image: img }));

  return createdEvent.id;
};

const editExistingEvent = async (
  guild: Guild,
  eventID: string,
  eventOptions: GuildScheduledEventCreateOptions,
  image: string | null,
): Promise<string> => {
  let event: GuildScheduledEvent;
  try {
    event = await guild.scheduledEvents.fetch(eventID);
  } catch (e) {
    console.error(e);

    return postEvent(guild, eventOptions, image);
  }

  try {
    // Without a thumbnail `image` stays undefined, which leaves an existing cover as it is.
    await withImageFallback(image, (img) => event.edit({ ...eventOptions, image: img }));
  } catch (e) {
    console.error(e);
  }

  return eventID;
};

/**
 * Schedule a new event for a tournament or edits an existing one.
 * @param client Discord.js Client
 * @param tournamentDetails The tournament to schedule
 * @returns The ID of the scheduled event
 */
export const scheduleEvent = async (
  guild: Guild,
  tournamentDetails: ITournament,
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  const eventOptions = buildEvent(tournamentDetails);
  const image = await fetchEventImage(tournamentDetails.image ?? "", fetchImpl);

  if (tournamentDetails.guildEventID) {
    return editExistingEvent(guild, tournamentDetails.guildEventID, eventOptions, image);
  }

  return postEvent(guild, eventOptions, image);
};
