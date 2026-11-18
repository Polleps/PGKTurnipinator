import { Client, Guild, RESTJSONErrorCodes } from "discord.js";
import Config from "./Config";
import { agendaChannelId } from "./commands/DeleteTournament";
import type { Tournament } from "./db/schema";
import type { TournamentRepository } from "./db/TournamentRepository";
import { createLogger } from "./utils/logger";

const log = createLogger("EndedCleanup");

/** Every morning at 06:00 Amsterdam time (DST-aware; Bun.cron interprets the expression in `tz`). */
export const CLEANUP_SCHEDULE = "0 6 * * *";
export const CLEANUP_TIME_ZONE = "Europe/Amsterdam";

/** What happened to one tournament's agenda message. */
export type CleanupOutcome =
  /** Deleted from Discord; the reference was cleared. */
  | "deleted"
  /** Discord no longer had it (10008 Unknown Message, e.g. deleted by hand); the reference was cleared. */
  | "already-gone"
  /** Not attempted (no agenda channel configured, unusable row); the reference was kept. */
  | "skipped"
  /** Discord refused or errored; the reference was kept, so the next run retries. */
  | "failed";

export interface CleanupItem {
  id: string;
  title: string;
  outcome: CleanupOutcome;
  reason?: string;
}

export interface CleanupSummary {
  items: CleanupItem[];
  counts: Record<CleanupOutcome, number>;
}

export interface CleanupDeps {
  repo: TournamentRepository;
  guild: Guild;
  now: number;
  channelIdFor?: (t: Tournament) => string | undefined;
}

const errorCode = (e: unknown): unknown => (e instanceof Error ? (e as { code?: unknown }).code : undefined);

const describeError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type TextChannel = { messages: { delete: (id: string) => Promise<unknown> } };

/**
 * Deletes the agenda message of every tournament that has ended at `now` (`endDate <= now`,
 * as everywhere else in the bot) and clears its stored message id. The tournament rows stay;
 * Discord scheduled events are left alone (Discord ends them itself). Runs one tournament at a
 * time; a failure is recorded and the run goes on. Never throws for a single tournament.
 */
export const cleanupEndedTournamentMessages = async ({
  repo,
  guild,
  now,
  channelIdFor = agendaChannelId,
}: CleanupDeps): Promise<CleanupSummary> => {
  const items: CleanupItem[] = [];
  // One fetch per channel per run; a failed fetch is remembered as its error.
  const channels = new Map<string, Promise<TextChannel>>();
  const channel = (id: string): Promise<TextChannel> => {
    let found = channels.get(id);
    if (!found) {
      found = guild.channels.fetch(id).then((c) => {
        if (!c?.isTextBased()) {
          throw new Error(`channel ${id} is not a text channel`);
        }
        return c;
      });
      channels.set(id, found);
    }
    return found;
  };

  for (const t of repo.endedWithMessage(now)) {
    const item = (outcome: CleanupOutcome, reason?: string) =>
      items.push({ id: t.id, title: t.title, outcome, ...(reason ? { reason } : {}) });

    // Defensive for legacy rows: the schema requires these, but never act on a row that lacks them.
    if (!t.messageID || typeof t.endDate !== "number" || !Number.isFinite(t.endDate)) {
      item("skipped", "no usable message id or end date");
      continue;
    }
    const channelId = channelIdFor(t);
    if (!channelId) {
      item("skipped", `no ${t.isOnline ? "online " : ""}agenda channel configured`);
      continue;
    }

    try {
      await (await channel(channelId)).messages.delete(t.messageID);
      repo.clearMessageId(t.id, t.messageID);
      item("deleted");
    } catch (e) {
      if (errorCode(e) === RESTJSONErrorCodes.UnknownMessage) {
        repo.clearMessageId(t.id, t.messageID);
        item("already-gone");
      } else {
        item("failed", describeError(e));
      }
    }
  }

  const counts: Record<CleanupOutcome, number> = { deleted: 0, "already-gone": 0, skipped: 0, failed: 0 };
  for (const { outcome } of items) {
    counts[outcome]++;
  }
  return { items, counts };
};

export const describeSummary = ({ items, counts }: CleanupSummary): string => {
  const head =
    `Ended tournament messages: ${counts.deleted} deleted, ${counts["already-gone"]} already gone, ` +
    `${counts.skipped} skipped, ${counts.failed} failed.`;
  const problems = items
    .filter((i) => i.outcome === "skipped" || i.outcome === "failed")
    .map((i) => `\n  ${i.outcome} ${i.id} "${i.title}": ${i.reason}`);
  return head + problems.join("");
};

/** Runs one cleanup against the bot's guild and logs the summary; never throws. */
export const runEndedTournamentCleanup = async (
  client: Client,
  repo: TournamentRepository,
  now: number = Date.now(),
): Promise<CleanupSummary | undefined> => {
  try {
    const guild = await client.guilds.fetch(Config.GUILD_ID);
    const summary = await cleanupEndedTournamentMessages({ repo, guild, now });
    log(describeSummary(summary));
    return summary;
  } catch (e) {
    log(`Cleanup of ended tournament messages failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return undefined;
  }
};

/** Schedules the daily cleanup in-process with Bun.cron. Returns the job (to stop it). */
export const startEndedTournamentCleanup = (client: Client, repo: () => TournamentRepository): Bun.CronJob => {
  // runEndedTournamentCleanup catches everything, so the job never emits an unhandled rejection.
  const job = Bun.cron(CLEANUP_SCHEDULE, () => runEndedTournamentCleanup(client, repo()), {
    tz: CLEANUP_TIME_ZONE,
  }).unref();
  const next = Bun.cron.parse(CLEANUP_SCHEDULE, Date.now(), { tz: CLEANUP_TIME_ZONE });
  log(
    `Deleting agenda messages of ended tournaments at ${CLEANUP_SCHEDULE} ${CLEANUP_TIME_ZONE}; ` +
      `next run ${next?.toISOString() ?? "never"}.`,
  );
  return job;
};
