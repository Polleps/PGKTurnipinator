import { Performer, IAction } from "./IAction";
import { IUserInfo } from "../discord.agent";
import Config from "../../Config";
import { sClient } from "../../Context";
import { Guild, GuildMember, RichEmbed, TextChannel } from "discord.js";
import { URL } from "url";
import * as moment from "moment";

const guildID = Config.GUILD_ID;
const roleName = Config.POST_TOURNAMENT_ROLE_NAME;
const tournamentagendaID = Config.TOURNAMEN_AGENDA_ID;

export const postTournament: Performer = (userInfo: IUserInfo, action: IAction): string => {
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
    const parsedTournament = JSON.parse(action.args[0]) as IParsedTournament;
    postInChannel(guild, user, parsedTournament);
  } catch (err) {
    console.log(err);
    throw new Error("Invalid Tournament Details.");
  }

  return "Done";
};

const postInChannel = (guild: Guild, user: GuildMember, tournamentDetails: IParsedTournament): void => {
  const channel = guild.channels.get(tournamentagendaID) as TextChannel;
  const embed = buildEmbed(user, tournamentDetails);
  channel.send(embed);
};

const buildEmbed = (user: GuildMember, tournamentDetails: IParsedTournament): RichEmbed => {
  let embed = new RichEmbed();
  // embed.setAuthor(`${user.user.username}#${user.user.discriminator}`, user.user.avatarURL);
  embed.setColor(3552822);
  embed.setThumbnail(tournamentDetails.imgURL);
  embed.addField(tournamentDetails.title, "\u200B");
  embed = buildLocation(embed, tournamentDetails);
  embed = buildDateField(embed, tournamentDetails);
  embed = buildEvents(embed, tournamentDetails);
  embed = buildPrices(embed, tournamentDetails);
  embed = buildDescription(embed, tournamentDetails);
  embed = buildLink(embed, tournamentDetails);
  return embed;
};

const buildLocation = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
  const gUrl = createGoogleMapsURL(tD.location, tD.locationID);
  return embed.addField("🗺 Location", `[${tD.location}](${gUrl})`);
};

const buildEvents = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
  const events = tD.events.filter((x) => !!x.name);

  if (events.length === 0) {
    throw new Error("No events found");
  }

  const hasCaps = events.some((x) => !!x.cap);
  const names = events.map((x) => `- ${x.name}`).join("\n");
  const caps = events.map((x) => `${x.cap}` || "-").join("\n");
  embed.addField("🕹 Events", names, hasCaps);
  if (hasCaps) {
    embed.addField("Player Cap", caps, true);
  }
  return embed;
};

const buildPrices = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
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

const buildDescription = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
  if (!tD.description || tD.description.trim().length === 0) {
    return embed;
  }
  if (tD.description.trim().length > 250) {
    throw new Error("Additional Notes text is to long.");
  }
  return embed.addField("Additional Info", tD.description);
};

const buildLink = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
  return embed.addField("More Info/Register", `[Smash.gg](${"https://smash.gg/tournament/" + tD.smashggLink})`);
};

const buildDateField = (embed: RichEmbed, tD: IParsedTournament): RichEmbed => {
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

interface IParsedTournament {
  smashggLink: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  locationID: string;
  events: IEvent[];
  description?: string;
  prices?: IPrice[];
  imgURL: string;
}

interface IEvent {
  name: string;
  cap?: string;
}

interface IPrice {
  name: string;
  amount: string;
}
