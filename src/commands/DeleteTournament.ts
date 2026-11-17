import {
  ActionRowBuilder,
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  Guild,
  MessageFlags,
  RESTJSONErrorCodes,
} from "discord.js";
import Config from "../Config";
import { store } from "../Store";
import type { Tournament } from "../db/schema";
import type { TournamentRepository } from "../db/TournamentRepository";
import { createLogger } from "../utils/logger";
import { CommandHandler } from "./CommandHandler";

const log = createLogger("DeleteTournament");

export const SLUG_OPTION = "slug";
/** Discord's limits for autocomplete: at most 25 choices, names of at most 100 characters. */
export const MAX_CHOICES = 25;
export const MAX_CHOICE_NAME = 100;
export const CONFIRM_TIMEOUT_MS = 60_000;

const CONFIRM_ID = "delete-tournament-confirm";
const CANCEL_ID = "delete-tournament-cancel";

// Tournaments are Dutch: dates are shown in Amsterdam time, whatever the server's TZ.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "16 Nov 2026" (in Amsterdam). */
export const formatShortDate = (epochMs: number): string => {
  const parts = Object.fromEntries(dateFormat.formatToParts(epochMs).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
};

/** Cuts `text` to at most `max` UTF-16 units, ending in "…" when cut; never splits a surrogate pair. */
export const truncate = (text: string, max: number): string => {
  if (text.length <= max) {
    return text;
  }
  let out = "";
  for (const char of text) {
    if (out.length + char.length > max - 1) {
      break;
    }
    out += char;
  }
  return `${out}…`;
};

/** "<slug> · <d MMM yyyy>"; the slug is shortened so the name fits Discord's limit, the date always shows. */
export const choiceName = (t: Pick<Tournament, "url" | "startDate">): string => {
  const suffix = ` · ${formatShortDate(t.startDate)}`;
  return `${truncate(t.url, MAX_CHOICE_NAME - suffix.length)}${suffix}`;
};

export const buildChoices = (tournaments: readonly Tournament[]): ApplicationCommandOptionChoiceData<string>[] =>
  tournaments.slice(0, MAX_CHOICES).map((t) => ({ name: choiceName(t), value: t.id }));

export type Resolved =
  { kind: "found"; tournament: Tournament } | { kind: "ended"; tournament: Tournament } | { kind: "not-found" };

/**
 * What the admin picked: a suggestion's value is the tournament id. Typed text instead is
 * matched exactly against the slugs of tournaments that haven't ended (newest edition first).
 */
export const resolveTournament = (repo: TournamentRepository, input: string, now: number): Resolved => {
  const byId = repo.getById(input.trim());
  if (byId) {
    return byId.endDate > now ? { kind: "found", tournament: byId } : { kind: "ended", tournament: byId };
  }
  const [bySlug] = repo.upcomingBySlug(input, now);
  return bySlug ? { kind: "found", tournament: bySlug } : { kind: "not-found" };
};

/** The agenda channel a tournament's message was posted in (as postEmbed picks it). */
export const agendaChannelId = (t: Pick<Tournament, "isOnline">): string | undefined =>
  (t.isOnline ? Config.ONLINE_TOURNAMENT_AGENDA_ID : Config.TOURNAMENT_AGENDA_ID) || undefined;

/** What happened to one Discord object. */
export type StepOutcome = "deleted" | "already-gone" | "none";

export type DeletionResult =
  | { ok: true; tournament: Tournament; message: StepOutcome; event: StepOutcome }
  | {
      ok: false;
      tournament?: Tournament;
      reason: string;
      /** A Discord deletion failed and the row was kept: running the command again retries. */
      retryable: boolean;
      /** Set when the agenda message step ran before the failure. */
      message?: StepOutcome;
    };

export interface DeletionDeps {
  repo: TournamentRepository;
  guild: Guild;
  now: number;
  channelIdFor?: (t: Tournament) => string | undefined;
}

const errorCode = (e: unknown): unknown => (e instanceof Error ? (e as { code?: unknown }).code : undefined);

const isGone = (e: unknown, ...codes: number[]): boolean => {
  const code = errorCode(e);
  return typeof code === "number" && codes.includes(code);
};

const describeError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const deleteAgendaMessage = async (
  guild: Guild,
  channelId: string | undefined,
  messageId: string | null,
): Promise<StepOutcome> => {
  if (!messageId) {
    return "none";
  }
  if (!channelId) {
    return "already-gone";
  }
  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      return "already-gone";
    }
    await channel.messages.delete(messageId);
    return "deleted";
  } catch (e) {
    if (isGone(e, RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.UnknownChannel)) {
      return "already-gone";
    }
    throw e;
  }
};

const deleteScheduledEvent = async (guild: Guild, eventId: string | null): Promise<StepOutcome> => {
  if (!eventId) {
    return "none";
  }
  try {
    await guild.scheduledEvents.delete(eventId);
    return "deleted";
  } catch (e) {
    if (isGone(e, RESTJSONErrorCodes.UnknownGuildScheduledEvent)) {
      return "already-gone";
    }
    throw e;
  }
};

/**
 * Removes a tournament: its agenda message, its Discord event, then its row. Re-reads the
 * row first (it may have been re-posted or removed while the admin was confirming). A message
 * or event that is already gone is fine; any other Discord failure keeps the row, so running
 * the command again retries (the parts already removed then count as gone).
 */
export const deleteTournament = async (
  { repo, guild, now, channelIdFor = agendaChannelId }: DeletionDeps,
  id: string,
): Promise<DeletionResult> => {
  const tournament = repo.getById(id);
  if (!tournament) {
    return { ok: false, reason: "It is no longer in the database (already deleted?).", retryable: false };
  }
  if (tournament.endDate <= now) {
    return { ok: false, tournament, reason: "It has already ended; past tournaments are kept.", retryable: false };
  }

  let message: StepOutcome;
  try {
    message = await deleteAgendaMessage(guild, channelIdFor(tournament), tournament.messageID);
  } catch (e) {
    return {
      ok: false,
      tournament,
      reason: `Deleting the agenda message failed: ${describeError(e)}`,
      retryable: true,
    };
  }

  let event: StepOutcome;
  try {
    event = await deleteScheduledEvent(guild, tournament.guildEventID);
  } catch (e) {
    return {
      ok: false,
      tournament,
      message,
      reason: `Deleting the Discord event failed: ${describeError(e)}`,
      retryable: true,
    };
  }

  repo.delete(tournament.id);
  return { ok: true, tournament, message, event };
};

const messageText: Record<StepOutcome, string> = {
  deleted: "agenda message removed",
  "already-gone": "agenda message was already gone",
  none: "no agenda message",
};

const eventText: Record<StepOutcome, string> = {
  deleted: "event removed",
  "already-gone": "event was already gone",
  none: "no event",
};

export const describeResult = (result: DeletionResult): string => {
  if (result.ok) {
    const { tournament, message, event } = result;
    return `Deleted **${tournament.title}**: ${messageText[message]}, ${eventText[event]}, removed from the agenda.`;
  }
  const name = result.tournament ? `**${result.tournament.title}**` : "the tournament";
  if (!result.retryable) {
    return `Could not delete ${name}. ${result.reason}`;
  }
  const partial = result.message === "deleted" ? " The agenda message was removed." : "";
  return `Could not delete ${name}. ${result.reason}.${partial} It is still on the agenda; run the command again to retry.`;
};

export const confirmationText = (t: Tournament): string => {
  const place = t.isOnline ? "online" : t.city || t.location || "unknown location";
  const removes = [
    t.messageID ? "its agenda message" : null,
    t.guildEventID ? "its Discord event" : null,
    "its entry on the website agenda",
  ].filter((x) => x !== null);
  return [
    `Delete **${t.title}** (\`${t.url}\`)?`,
    `📅 ${formatShortDate(t.startDate)} · ${place}`,
    `This removes ${removes.join(", ")}. It can't be undone.`,
  ].join("\n");
};

export const confirmationButtons = (): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CONFIRM_ID).setLabel("Delete").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(CANCEL_ID).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );

/**
 * Collector filter for the confirmation buttons: only the admin who ran the command may
 * answer; anyone else is told so (ephemerally) and ignored.
 */
export const onlyInvoker =
  (invokerId: string) =>
  (button: ButtonInteraction): boolean => {
    if (button.user.id === invokerId) {
      return true;
    }
    button
      .reply({ content: "Only the admin who ran this command can answer it.", flags: MessageFlags.Ephemeral })
      .catch(log);
    return false;
  };

/** `/delete-tournament slug:<...>`: removes an upcoming tournament from the agenda after confirmation. */
export class DeleteTournamentCommand implements CommandHandler {
  constructor(
    private readonly repo: () => TournamentRepository = () => store.tournaments,
    private readonly now: () => number = Date.now,
  ) {}

  public async autocomplete(interaction: AutocompleteInteraction) {
    const typed = interaction.options.getFocused();
    const choices = buildChoices(this.repo().searchUpcoming(typed, this.now(), MAX_CHOICES));
    await interaction.respond(choices);
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    const input = interaction.options.getString(SLUG_OPTION, true);
    const resolved = resolveTournament(this.repo(), input, this.now());

    if (resolved.kind === "not-found") {
      await interaction.reply({
        content: `No upcoming tournament found for \`${truncate(input, 100)}\`. Pick one from the suggestions.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (resolved.kind === "ended") {
      await interaction.reply({
        content: `**${resolved.tournament.title}** has already ended; past tournaments are kept.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { tournament } = resolved;
    const response = await interaction.reply({
      content: confirmationText(tournament),
      components: [confirmationButtons()],
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
    const prompt = response.resource?.message;
    if (!prompt) {
      throw new Error("The confirmation message was not returned.");
    }

    let button: ButtonInteraction;
    try {
      button = await prompt.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: onlyInvoker(interaction.user.id),
        time: CONFIRM_TIMEOUT_MS,
      });
    } catch {
      await interaction
        .editReply({ content: `No answer within a minute; **${tournament.title}** was not deleted.`, components: [] })
        .catch(log);
      return;
    }

    if (button.customId !== CONFIRM_ID) {
      await button.update({ content: `Cancelled; **${tournament.title}** was not deleted.`, components: [] });
      return;
    }

    await button.update({ content: `Deleting **${tournament.title}**...`, components: [] });

    const guild = interaction.guild ?? (await interaction.client.guilds.fetch(interaction.guildId!));
    const result = await deleteTournament({ repo: this.repo(), guild, now: this.now() }, tournament.id);
    const who = `${interaction.user.tag} (${interaction.user.id})`;
    if (result.ok) {
      log(
        `${who} deleted tournament ${tournament.id} "${tournament.title}" (${tournament.url}): ` +
          `message ${result.message}, event ${result.event}.`,
      );
    } else {
      log(`${who} could not delete tournament ${tournament.id} "${tournament.title}": ${result.reason}`);
    }
    await button.editReply({ content: describeResult(result) });
  }
}
