import { Guild, GuildMember, EmbedBuilder, NewsChannel } from "discord.js";
import moment from "moment-timezone";

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

const buildDescription = (
  embed: EmbedBuilder,
  tD: ITournament
): EmbedBuilder => {
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
    value: moment(startDate).tz("Europe/Amsterdam").format("HH:mm"),
  });
};

const buildDateField = (embed: EmbedBuilder, tD: ITournament): EmbedBuilder => {
  const startDate = new Date(tD.startDate);
  const endDate = new Date(tD.endDate);
  const spansSingleDay = compareDay(startDate, endDate);

  return embed.addFields({
    name: "📅 Date",
    value: spansSingleDay
      ? formatDate(startDate)
      : `${formatDate(startDate)} - ${formatDate(endDate)}`,
  });
};

const compareDay = (a: Date, b: Date): boolean =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

const createGoogleMapsURL = (
  location: string,
  googleMapsID: string
): string => {
  const url = new URL(
    `https://www.google.com/maps/search/?api=1&query=${location}&query_place_id=${googleMapsID}`
  );

  return url.toString();
};

const formatDate = (x: Date): string => moment(x).format("MMMM Do YYYY");

/** Who posted the tournament, shown in the embed footer. */
export interface EmbedPoster {
  username: string;
  discriminator: string;
  avatarURL: string | null;
}

export const buildEmbed = (
  poster: EmbedPoster,
  tournamentDetails: ITournament
): EmbedBuilder => {
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

  const title = tournamentDetails.isOnline
    ? `🌐 ${tournamentDetails.title}`
    : tournamentDetails.title;
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

const postMessage = async (
  channel: NewsChannel,
  embed: EmbedBuilder
): Promise<string> => {
  const message = await channel.send({ embeds: [embed] });

  return message.id;
};

const editExistingPost = async (
  channel: NewsChannel,
  tournament: ITournament,
  embed: EmbedBuilder
) => {
  try {
    const prevMessage = await channel.messages.fetch(tournament.messageID!);
    prevMessage.edit({ embeds: [embed] });
  } catch (e) {
    // If the message has already been deleted, post a new one.
    console.error(e);

    return postMessage(channel, embed);
  }

  return tournament.messageID!;
};

/**
 * Post tournament details as embed in a discord server or updates message if the tournament is already in the channel.
 * @param guild The Discord server to send the message in
 * @param user Discord member that posted the tournament.
 * @param tournamentDetails The tournament details to be posted.
 * @returns id of the posted message.
 */
export const postEmbed = async (
  guild: Guild,
  user: GuildMember,
  tournamentDetails: ITournament
): Promise<string> => {
  const { isOnline } = tournamentDetails;

  const channel = (await guild.channels.fetch(
    isOnline ? onlineTournamentAgendaID : tournamentagendaID
  )) as NewsChannel;
  const embed = buildEmbed(
    {
      username: user.user.username,
      discriminator: user.user.discriminator,
      avatarURL: user.user.avatarURL(),
    },
    tournamentDetails
  );

  if (tournamentDetails.messageID) {
    return editExistingPost(channel, tournamentDetails, embed);
  }

  return postMessage(channel, embed);
};
