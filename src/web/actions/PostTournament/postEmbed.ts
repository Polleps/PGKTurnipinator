import { Guild, GuildMember, MessageEmbed, NewsChannel } from "discord.js";
import moment from "moment-timezone";

import Config from "../../../Config";
import ITournament from "../../../models/ITournament";

const tournamentagendaID = Config.TOURNAMENT_AGENDA_ID;
const onlineTournamentAgendaID = Config.ONLINE_TOURNAMENT_AGENDA_ID;

const buildLocation = (embed: MessageEmbed, tD: ITournament): MessageEmbed => {
  const gUrl = createGoogleMapsURL(tD.location, tD.locationID);

  return embed.addField("🗺 Location", `[${tD.location}](${gUrl})`);
};

const buildEvents = (embed: MessageEmbed, tD: ITournament): MessageEmbed => {
  const events = tD.events.filter((x) => !!x.name);

  if (events.length === 0) {
    throw new Error("No events found");
  }

  const hasCaps = events.some((x) => !!x.cap);
  const names = events.map((x) => `- ${x.name}`).join("\n");
  const caps = events.map((x) => `${x.cap}` || "-").join("\n");

  embed.addField("🕹 Events", names, hasCaps);

  if (hasCaps) {
    embed.addField("Cap", caps, true);
  }

  return embed;
};

const buildDescription = (
  embed: MessageEmbed,
  tD: ITournament
): MessageEmbed => {
  if (!tD.description || tD.description.trim().length === 0) {
    return embed;
  }

  if (tD.description.trim().length > 250) {
    throw new Error("Additional Notes text is to long.");
  }

  return embed.addField("Additional Info", tD.description);
};

const buildLink = (embed: MessageEmbed, tD: ITournament): MessageEmbed =>
  embed.addField(
    "More Info/Register",
    `[Start.gg](${"https://start.gg/tournament/" + tD.url})`
  );

const buildTimeField = (embed: MessageEmbed, tD: ITournament): MessageEmbed => {
  const { startDate } = tD;

  return embed.addField(
    "⏰ Time",
    moment(startDate).tz("Europe/Amsterdam").format("HH:mm")
  );
};

const buildDateField = (embed: MessageEmbed, tD: ITournament): MessageEmbed => {
  const startDate = new Date(tD.startDate);
  const endDate = new Date(tD.endDate);
  const spansSingleDay = compareDay(startDate, endDate);

  return embed.addField(
    "📅 Date",
    spansSingleDay
      ? formatDate(startDate)
      : `${formatDate(startDate)} - ${formatDate(endDate)}`
  );
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

const buildEmbed = (
  user: GuildMember,
  tournamentDetails: ITournament
): MessageEmbed => {
  const localColor = 0xc01f1f;
  const onlineColor = 0x0b92e0;

  let embed = new MessageEmbed();
  embed.setColor(tournamentDetails.isOnline ? onlineColor : localColor);
  embed.setThumbnail(tournamentDetails.image);
  embed.setFooter({
    text: `${user.user.username}#${user.user.discriminator}`,
    iconURL: user.user.avatarURL(),
  });

  const title = tournamentDetails.isOnline
    ? `🌐 ${tournamentDetails.title}`
    : tournamentDetails.title;
  embed.addField(title, "\u200B");

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
  embed: MessageEmbed
): Promise<string> => {
  const message = await channel.send({ embeds: [embed] });

  return message.id;
};

const editExistingPost = async (
  channel: NewsChannel,
  tournament: ITournament,
  embed: MessageEmbed
) => {
  try {
    const prevMessage = await channel.messages.fetch(tournament.messageID);
    prevMessage.edit({ embeds: [embed] });
  } catch (e) {
    // If the message has already been deleted, post a new one.
    console.error(e);

    return postMessage(channel, embed);
  }

  return tournament.messageID;
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
  const embed = buildEmbed(user, tournamentDetails);

  if (tournamentDetails.messageID) {
    return editExistingPost(channel, tournamentDetails, embed);
  }

  return postMessage(channel, embed);
};
