import { Performer, IAction } from "./IAction";
import { IUserInfo } from "../discord.agent";
import Config from "../../Config";
import { sClient } from "../../Context";
import ITournament from "../../models/ITournament";
import { store } from "../../Store";
import { Guild, GuildMember, RichEmbed, NewsChannel, Message } from "discord.js";
import { URL } from "url";
import moment from "moment-timezone";
import { TournamentStoreCache } from "../../stores";

const guildID = Config.GUILD_ID;
const roleName = Config.POST_TOURNAMENT_ROLE_NAME;
const tournamentagendaID = Config.TOURNAMENT_AGENDA_ID;
const onlineTournamentAgendaID = Config.ONLINE_TOURNAMENT_AGENDA_ID;
const cache = store.cache("tournaments") as TournamentStoreCache;
/**
 * Perform 'posttournament' action.
 * TO's fill in details about tournament and the tournament gets posted in the discord channels and the online agenda.
 * @param userInfo OATH User info.
 * @param action action parameters.
 */
export const postTournament: Performer = async (userInfo: IUserInfo, action: IAction): Promise<string> => {
  const client = sClient.client;
  const guild = client.guilds.get(guildID);
  const user = guild.members.get(userInfo.id);
  const role = guild.roles.find((x) => x.name === roleName);

  if (!action.args || action.args.length < 1) {
    throw new Error("Invalid Action.");
  }

  if (!user) {
    throw new Error("You're not in the Discord.");
  }

  if (!user.roles.has(role.id)) {
    throw new Error("You are not allowed to post tournaments.");
  }

  try {
    const parsedTournament = JSON.parse(action.args[0]) as ITournament;
    const existingTournament = cache.getByID(parsedTournament.id);
    if (existingTournament) {
      parsedTournament.messageID = existingTournament.messageID;
    }
    if (action.args[1] !== "saveonly") {
      const messageID = await postInChannel(guild, user, parsedTournament);
      parsedTournament.messageID = messageID;
    }
    storeTournament(parsedTournament);
  } catch (err) {
    console.log(err);
    throw new Error("Invalid Tournament Details.");
  }

  return "Done";
};

/**
 * Post tournament details as embed in a discord server or updates message if the tournament is already in the channel.
 * @param guild The Discord server to send the message in
 * @param user Discord member that posted the tournament.
 * @param tournamentDetails The tournament details to be posted.
 * @returns id of the posted message.
 */
const postInChannel = async (guild: Guild, user: GuildMember, tournamentDetails: ITournament): Promise<string> => {
  const { isOnline } = tournamentDetails;

  const channel = guild.channels.get(isOnline ? onlineTournamentAgendaID : tournamentagendaID) as NewsChannel;
  const embed = buildEmbed(user, tournamentDetails);

  // Update message if it already exists.
  if (tournamentDetails.messageID) {
    const prevMessage = await channel.fetchMessage(tournamentDetails.messageID);
    prevMessage.edit(embed);
    return tournamentDetails.messageID;
  }

  const message = await channel.send(embed);
  return (message as Message).id;
};

/**
 * Create the message embed.
 * @param user User that posted the tournament
 * @param tournamentDetails tournament details used to build the embed.
 */
const buildEmbed = (user: GuildMember, tournamentDetails: ITournament): RichEmbed => {
  const localColor = 0xc01f1f;
  const onlineColor = 0x0b92e0;
  let embed = new RichEmbed();
  embed.setColor(tournamentDetails.isOnline ? onlineColor : localColor);
  embed.setThumbnail(tournamentDetails.image);
  embed.setFooter(`${user.user.username}#${user.user.discriminator}`, user.user.avatarURL);

  const title = tournamentDetails.isOnline ? `🌐 ${tournamentDetails.title}` : tournamentDetails.title;
  embed.addField(title, "\u200B");

  if (tournamentDetails.isOnline) {
    embed = buildDateField(embed, tournamentDetails);
    embed = buildTimeField(embed, tournamentDetails);
  } else {
    embed = buildLocation(embed, tournamentDetails);
    embed = buildDateField(embed, tournamentDetails);
  }

  embed = buildEvents(embed, tournamentDetails);
  // embed = buildPrices(embed, tournamentDetails);
  embed = buildDescription(embed, tournamentDetails);
  embed = buildLink(embed, tournamentDetails);
  return embed;
};

const buildLocation = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  const gUrl = createGoogleMapsURL(tD.location, tD.locationID);
  return embed.addField("🗺 Location", `[${tD.location}](${gUrl})`);
};

const buildEvents = (embed: RichEmbed, tD: ITournament): RichEmbed => {
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

const buildPrices = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  if (!tD.prices) {
    return embed;
  }
  const prices = tD.prices.filter((x) => !!x.name);
  if (prices.length === 0) {
    return embed;
  }
  const names = prices.map((x) => `- ${x.name}`).join("\n");
  const amounts = prices.map((x) => `€${(+x.amount).toFixed(2)}`).join("\n");
  embed.addField("💰 Price", names, true);
  embed.addField("Amount", amounts, true);
  return embed;
};

const buildDescription = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  if (!tD.description || tD.description.trim().length === 0) {
    return embed;
  }
  if (tD.description.trim().length > 250) {
    throw new Error("Additional Notes text is to long.");
  }
  return embed.addField("Additional Info", tD.description);
};

const buildLink = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  return embed.addField("More Info/Register", `[Smash.gg](${"https://smash.gg/tournament/" + tD.url})`);
};

const buildTimeField = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  const { startDate } = tD;
  return embed.addField("⏰ Time", moment(startDate).tz("Europe/Amsterdam").format("HH:mm"));
}

const buildDateField = (embed: RichEmbed, tD: ITournament): RichEmbed => {
  const startDate = new Date(tD.startDate);
  const endDate = new Date(tD.endDate);
  const spansSingleDay = compareDay(startDate, endDate);
  return embed.addField(
    "📅 Date",
    spansSingleDay ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`,
  );
};

const compareDay = (a: Date, b: Date): boolean => {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
};

const createGoogleMapsURL = (location: string, googleMapsID: string): string => {
  const url = new URL(`https://www.google.com/maps/search/?api=1&query=${location}&query_place_id=${googleMapsID}`);
  return url.toString();
};

const formatDate = (x: Date): string => {
  return moment(x).format("MMMM Do YYYY");
};

const padNumber = (x: number): string => {
  return x < 10 ? `0${x}` : `${x}`;
};

/**
 * Stores a tournament in the database.
 * @param t tournament details to be inserted in the Object store.
 */
const storeTournament = (t: ITournament) => {
  cache.add(t);
};
