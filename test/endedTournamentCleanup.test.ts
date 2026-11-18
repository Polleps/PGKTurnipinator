import { describe, expect, mock, test } from "bun:test";
import { Client, DiscordAPIError, Guild, RESTJSONErrorCodes } from "discord.js";
import { openDatabase } from "../src/db/database";
import type { NormalizedTournament } from "../src/db/normalizeTournament";
import { TournamentRepository } from "../src/db/TournamentRepository";
import {
  CLEANUP_SCHEDULE,
  CLEANUP_TIME_ZONE,
  cleanupEndedTournamentMessages,
  describeSummary,
  startEndedTournamentCleanup,
} from "../src/endedTournamentCleanup";

const HOUR = 3600000;
// 06:00 in Amsterdam (CET, UTC+1).
const NOW = Date.parse("2026-11-18T05:00:00Z");

const tournament = (id: string, overrides: Partial<NormalizedTournament> = {}): NormalizedTournament => ({
  id,
  url: `slug-${id}`,
  title: `Tournament ${id}`,
  image: "",
  description: "",
  location: "Some Street 1",
  city: "Utrecht",
  locationID: "",
  startDate: NOW - 20 * HOUR,
  endDate: NOW - 10 * HOUR,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "" }],
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: `msg-${id}`,
  guildEventID: null,
  ...overrides,
});

const memoryRepo = () => new TournamentRepository(openDatabase({ path: ":memory:" }));

const apiError = (code: number, message: string, status = 404) =>
  new DiscordAPIError({ code, message }, code, status, "DELETE", "https://discord.test/x", {});

const channelIdFor = (t: { isOnline: boolean }) => (t.isOnline ? "online-agenda" : "agenda");

/** A guild whose channels record deleted messages; `errors` maps a message id to the error deleting it throws. */
const fakeGuild = (opts: { errors?: Record<string, Error>; channelError?: Error } = {}) => {
  const deleteMessage = mock(async (id: string) => {
    const error = opts.errors?.[id];
    if (error) {
      throw error;
    }
  });
  const fetchChannel = mock(async (_id: string) => {
    if (opts.channelError) {
      throw opts.channelError;
    }
    return { isTextBased: () => true, messages: { delete: deleteMessage } };
  });
  const deleteEvent = mock(async (_id: string) => {});
  const guild = { channels: { fetch: fetchChannel }, scheduledEvents: { delete: deleteEvent } } as unknown as Guild;
  return { guild, deleteMessage, fetchChannel, deleteEvent };
};

describe("TournamentRepository.endedWithMessage", () => {
  test("only ended tournaments (end_date <= now) that still have a message", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("ended"));
    repo.upsert(tournament("ends-now", { endDate: NOW }));
    repo.upsert(tournament("ongoing", { endDate: NOW + HOUR }));
    repo.upsert(tournament("upcoming", { startDate: NOW + 10 * HOUR, endDate: NOW + 20 * HOUR }));
    repo.upsert(tournament("unposted", { messageID: null }));
    expect(repo.endedWithMessage(NOW).map((t) => t.id)).toEqual(["ended", "ends-now"]);
  });

  test("clearMessageId only clears the message id it was given", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    expect(repo.clearMessageId("1", "other-msg")).toBe(false);
    expect(repo.getById("1")?.messageID).toBe("msg-1");
    expect(repo.clearMessageId("1", "msg-1")).toBe(true);
    expect(repo.getById("1")?.messageID).toBeNull();
  });
});

describe("cleanupEndedTournamentMessages", () => {
  test("deletes messages of ended tournaments from the right channel and keeps the rows", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("local", { guildEventID: "event-1" }));
    repo.upsert(tournament("online", { isOnline: true, location: "", city: "" }));
    repo.upsert(tournament("ongoing", { endDate: NOW + HOUR }));
    const { guild, deleteMessage, fetchChannel, deleteEvent } = fakeGuild();

    const summary = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });

    expect(summary.counts).toEqual({ deleted: 2, "already-gone": 0, skipped: 0, failed: 0 });
    expect(deleteMessage.mock.calls.map(([id]) => id)).toEqual(["msg-local", "msg-online"]);
    expect(fetchChannel.mock.calls.map(([id]) => id)).toEqual(["agenda", "online-agenda"]);
    // Discord removes ended scheduled events itself.
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(repo.count()).toBe(3);
    expect(repo.getById("local")).toMatchObject({ messageID: null, guildEventID: "event-1" });
    expect(repo.getById("online")?.messageID).toBeNull();
    expect(repo.getById("ongoing")?.messageID).toBe("msg-ongoing");
  });

  test("a message deleted by hand (10008) is fine and its reference is cleared", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    const { guild } = fakeGuild({
      errors: { "msg-1": apiError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message") },
    });

    const summary = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });

    expect(summary.items).toEqual([{ id: "1", title: "Tournament 1", outcome: "already-gone" }]);
    expect(repo.getById("1")?.messageID).toBeNull();
  });

  test("one failure does not stop the run, and its reference is kept for the next run", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("a", { startDate: NOW - 30 * HOUR }));
    repo.upsert(tournament("b"));
    const { guild, deleteMessage } = fakeGuild({ errors: { "msg-a": apiError(50013, "Missing Permissions", 403) } });

    const summary = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });

    expect(summary.items).toEqual([
      { id: "a", title: "Tournament a", outcome: "failed", reason: "Missing Permissions" },
      { id: "b", title: "Tournament b", outcome: "deleted" },
    ]);
    expect(deleteMessage).toHaveBeenCalledTimes(2);
    expect(repo.getById("a")?.messageID).toBe("msg-a");
    expect(repo.getById("b")?.messageID).toBeNull();
    expect(describeSummary(summary)).toBe(
      'Ended tournament messages: 1 deleted, 0 already gone, 0 skipped, 1 failed.\n  failed a "Tournament a": Missing Permissions',
    );
  });

  test("an unreachable channel fails its tournaments without clearing them; it is fetched once", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    repo.upsert(tournament("2"));
    const { guild, fetchChannel } = fakeGuild({
      channelError: apiError(RESTJSONErrorCodes.UnknownChannel, "Unknown Channel"),
    });

    const summary = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });

    expect(summary.counts.failed).toBe(2);
    expect(fetchChannel).toHaveBeenCalledTimes(1);
    expect(repo.getById("1")?.messageID).toBe("msg-1");
  });

  test("no configured agenda channel: skipped, reference kept", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1", { isOnline: true }));
    const { guild, fetchChannel } = fakeGuild();

    const summary = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor: () => undefined });

    expect(summary.items).toEqual([
      { id: "1", title: "Tournament 1", outcome: "skipped", reason: "no online agenda channel configured" },
    ]);
    expect(fetchChannel).not.toHaveBeenCalled();
    expect(repo.getById("1")?.messageID).toBe("msg-1");
  });

  test("a second run has nothing left to do", async () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    const { guild, deleteMessage } = fakeGuild();
    await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });
    const again = await cleanupEndedTournamentMessages({ repo, guild, now: NOW, channelIdFor });
    expect(again.items).toEqual([]);
    expect(deleteMessage).toHaveBeenCalledTimes(1);
  });
});

describe("schedule", () => {
  test("06:00 Amsterdam time, whatever the server's time zone (DST-aware)", () => {
    // Winter (CET, UTC+1) and summer (CEST, UTC+2).
    const winter = Bun.cron.parse(CLEANUP_SCHEDULE, Date.parse("2026-11-18T12:00:00Z"), { tz: CLEANUP_TIME_ZONE });
    const summer = Bun.cron.parse(CLEANUP_SCHEDULE, Date.parse("2026-07-01T12:00:00Z"), { tz: CLEANUP_TIME_ZONE });
    expect(winter?.toISOString()).toBe("2026-11-19T05:00:00.000Z");
    expect(summer?.toISOString()).toBe("2026-07-02T04:00:00.000Z");
  });

  test("schedules nothing unless MESSAGE_CLEANUP_ENABLED=true", () => {
    expect(startEndedTournamentCleanup({} as Client, memoryRepo, {})).toBeUndefined();
    expect(startEndedTournamentCleanup({} as Client, memoryRepo, { MESSAGE_CLEANUP_ENABLED: "false" })).toBeUndefined();
    expect(startEndedTournamentCleanup({} as Client, memoryRepo, { MESSAGE_CLEANUP_ENABLED: "1" })).toBeUndefined();
  });

  test("schedules an in-process Bun.cron job when enabled", () => {
    const job = startEndedTournamentCleanup({} as Client, memoryRepo, { MESSAGE_CLEANUP_ENABLED: "true" });
    expect(job?.cron).toBe("0 6 * * *");
    job?.stop();
  });
});
