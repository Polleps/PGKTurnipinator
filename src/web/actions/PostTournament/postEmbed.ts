import {
  DiscordAPIError,
  EmbedBuilder,
  Guild,
  GuildMember,
  type Message,
  NewsChannel,
  RESTJSONErrorCodes,
} from "discord.js";

import Config from "../../../Config";
import ITournament from "../../../models/ITournament";

const tournamentagendaID = Config.TOURNAMENT_AGENDA_ID;
const onlineTournamentAgendaID = Config.ONLINE_TOURNAMENT_AGENDA_ID;

const buildLocation = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  const gUrl = createGoogleMapsURL(tD.location, tD.locationID);

  return embed.addFields({ name: "🗺 Location", value: `[${tD.location}](${gUrl})` });
};

const buildEvents = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  const events = tD.events.filter((x) => !!x.name);

  if (events.length === 0) {
    throw new Error("No events found");
  }

  const hasCaps = events.some((x) => !!x.cap);
  const names = events.map((x) => `- ${x.name}`).join("\n");
  const caps = events.map((x) => `${x.cap}` || "-").join("\n");

  embed.addFields({ name: "🕹 Events", value: names, inline: hasCaps });

  if (hasCaps) {
    embed.addFields({ name: "Cap", value: caps, inline: true });
  }

  return embed;
};

const buildDescription = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  if (!tD.description || tD.description.trim().length === 0) {
    return embed;
  }

  if (tD.description.trim().length > 250) {
    throw new Error("Additional Notes text is to long.");
  }

  return embed.addFields({ name: "Additional Info", value: tD.description });
};

const buildLink = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder =>
  embed.addFields({
    name: "More Info/Register",
    value: `[Start.gg](${"https://start.gg/tournament/" + tD.url})`,
  });

const buildTimeField = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  const { startDate } = tD;

  return embed.addFields({
    name: "⏰ Time",
    value: formatTime(startDate),
  });
};

const buildDateField = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  const startDate = new Date(tD.startDate);
  const endDate = new Date(tD.endDate);
  const spansSingleDay = compareDay(startDate, endDate);

  return embed.addFields({
    name: "📅 Date",
    value: spansSingleDay ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`,
  });
};

const compareDay = (a: Date, b: Date): boolean => {
  const day = (x: Date) => {
    const { year, month, day } = dateParts(x);
    return `${year}-${month}-${day}`;
  };
  return day(a) === day(b);
};

const createGoogleMapsURL = (location: string, googleMapsID: string): string => {
  const url = new URL(`https://www.google.com/maps/search/?api=1&query=${location}&query_place_id=${googleMapsID}`);

  return url.toString();
};

// Tournaments are Dutch: dates and times are shown in Amsterdam time, whatever the server's TZ.
const TIME_ZONE = "Europe/Amsterdam";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const partsOf = (
  format: Intl.DateTimeFormat,
  x: Date | number,
): Partial<Record<Intl.DateTimeFormatPartTypes, string>> =>
  Object.fromEntries(format.formatToParts(x).map((p) => [p.type, p.value]));

const dateParts = (x: Date) => partsOf(dateFormat, x);

const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });
const ordinalSuffix: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };
const ordinal = (n: number): string => `${n}${ordinalSuffix[ordinalRules.select(n)] ?? "th"}`;

/** "March 14th 2026" (in Amsterdam). */
export const formatDate = (x: Date): string => {
  const { year, month, day } = dateParts(x);
  return `${month} ${ordinal(Number(day))} ${year}`;
};

/** "20:05" (24-hour, in Amsterdam). */
export const formatTime = (x: Date | number): string => {
  const { hour, minute } = partsOf(timeFormat, x);
  return `${hour}:${minute}`;
};

/** Who posted the tournament, shown in the embed footer. */
export interface EmbedPoster {
  username: string;
  discriminator: string;
  avatarURL: string | null;
}

export const buildEmbed = (poster: EmbedPoster, tournamentDetails: ITournament): EmbedBuilder => {
  const localColor = 0xc01f1f;
  const onlineColor = 0x0b92e0;

  let embed = new EmbedBuilder();
  embed.setColor(tournamentDetails.isOnline ? onlineColor : localColor);
  // The builder rejects undefined/"" (v13 sent an empty thumbnail).
  embed.setThumbnail(tournamentDetails.image?.trim() || null);
  embed.setFooter({
    text: `${poster.username}#${poster.discriminator}`,
    iconURL: poster.avatarURL ?? undefined,
  });

  const title = tournamentDetails.isOnline ? `🌐 ${tournamentDetails.title}` : tournamentDetails.title;
  embed.addFields({ name: title, value: "\u200B" });

  if (tournamentDetails.isOnline) {
    embed = buildDateField(embed, tournamentDetails);
    embed = buildTimeField(embed, tournamentDetails);
  } else {
    embed = buildLocation(embed, tournamentDetails);
    embed = buildDateField(embed, tournamentDetails);
  }

  embed = buildEvents(embed, tournamentDetails);
  embed = buildDescription(embed, tournamentDetails);
  embed = buildLink(embed, tournamentDetails);

  return embed;
};

const postMessage = async (channel: NewsChannel, embed: EmbedBuilder): Promise<string> => {
  const message = await channel.send({ embeds: [embed] });

  return message.id;
};

/**
 * Edits the tournament's agenda message. Only a message that is gone (Unknown Message) is posted
 * anew; any other failure is thrown, since posting then could leave a second message behind.
 */
const editExistingPost = async (channel: NewsChannel, messageID: string, embed: EmbedBuilder): Promise<string> => {
  let prevMessage: Message;
  try {
    prevMessage = await channel.messages.fetch(messageID);
  } catch (e) {
    if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownMessage) {
      console.warn(`Agenda message ${messageID} was deleted; posting a new one.`);

      return postMessage(channel, embed);
    }
    throw e;
  }

  await prevMessage.edit({ embeds: [embed] });

  return messageID;
};

/**
 * Post tournament details as embed in a discord server or updates message if the tournament is already in the channel.
 * @param guild The Discord server to send the message in
 * @param user Discord member that posted the tournament.
 * @param tournamentDetails The tournament details to be posted.
 * @returns id of the posted message.
 */
export const postEmbed = async (guild: Guild, user: GuildMember, tournamentDetails: ITournament): Promise<string> => {
  const { isOnline } = tournamentDetails;

  const channel = (await guild.channels.fetch(isOnline ? onlineTournamentAgendaID : tournamentagendaID)) as NewsChannel;
  const embed = buildEmbed(
    {
      username: user.user.username,
      discriminator: user.user.discriminator,
      avatarURL: user.user.avatarURL(),
    },
    tournamentDetails,
  );

  if (tournamentDetails.messageID) {
    return editExistingPost(channel, tournamentDetails.messageID, embed);
  }

  return postMessage(channel, embed);
};
