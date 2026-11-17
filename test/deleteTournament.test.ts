import { describe, expect, mock, test } from "bun:test";
import { ButtonInteraction, DiscordAPIError, Guild, RESTJSONErrorCodes } from "discord.js";
import {
  buildChoices,
  choiceName,
  confirmationText,
  deleteTournament,
  describeResult,
  MAX_CHOICE_NAME,
  onlyInvoker,
  resolveTournament,
  truncate,
} from "../src/commands/DeleteTournament";
import { openDatabase } from "../src/db/database";
import type { NormalizedTournament } from "../src/db/normalizeTournament";
import { TournamentRepository } from "../src/db/TournamentRepository";

const HOUR = 3600000;
// 23:30 UTC on 15 Nov is already 16 Nov in Amsterdam.
const NOW = Date.parse("2026-11-15T23:30:00Z");

const tournament = (id: string, overrides: Partial<NormalizedTournament> = {}): NormalizedTournament => ({
  id,
  url: `slug-${id}`,
  title: `Tournament ${id}`,
  image: "",
  description: "",
  location: "Some Street 1",
  city: "Utrecht",
  locationID: "",
  startDate: NOW + 24 * HOUR,
  endDate: NOW + 30 * HOUR,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "" }],
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: null,
  guildEventID: null,
  ...overrides,
});

const memoryRepo = () => new TournamentRepository(openDatabase({ path: ":memory:" }));

const apiError = (code: number, message: string, status = 404) =>
  new DiscordAPIError({ code, message }, code, status, "DELETE", "https://discord.test/x", {});

describe("TournamentRepository.searchUpcoming", () => {
  test("excludes ended tournaments and orders by start date, then id", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("ended", { startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    repo.upsert(tournament("ends-now", { startDate: NOW - 10 * HOUR, endDate: NOW }));
    repo.upsert(tournament("later", { startDate: NOW + 48 * HOUR, endDate: NOW + 50 * HOUR }));
    repo.upsert(tournament("b"));
    repo.upsert(tournament("a"));
    repo.upsert(tournament("ongoing", { startDate: NOW - HOUR, endDate: NOW + HOUR }));
    expect(repo.searchUpcoming("", NOW, 25).map((t) => t.id)).toEqual(["ongoing", "a", "b", "later"]);
  });

  test("filters case-insensitively on the slug, and on the title as a fallback", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1", { url: "dutch-smash-weekly-12", title: "Weekly" }));
    repo.upsert(tournament("2", { url: "other", title: "Big DUTCH Major" }));
    repo.upsert(tournament("3", { url: "unrelated", title: "Unrelated" }));
    repo.upsert(tournament("4", { url: "dutch-old", startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    expect(repo.searchUpcoming("  Dutch ", NOW, 25).map((t) => t.id)).toEqual(["1", "2"]);
    // LIKE wildcards are plain text here.
    expect(repo.searchUpcoming("%", NOW, 25)).toEqual([]);
  });

  test("returns at most `limit` rows", () => {
    const repo = memoryRepo();
    for (let i = 0; i < 30; i++) {
      repo.upsert(tournament(String(100 + i), { startDate: NOW + (i + 1) * HOUR, endDate: NOW + (i + 2) * HOUR }));
    }
    const found = repo.searchUpcoming("", NOW, 25);
    expect(found).toHaveLength(25);
    expect(found[0]?.id).toBe("100");
    expect(found[24]?.id).toBe("124");
  });

  test("range-scans the end_date index rather than walking every past tournament", () => {
    const db = openDatabase({ path: ":memory:" });
    const query = new TournamentRepository(db).searchUpcomingQuery("x", NOW, 25).toSQL();
    const plan = db.$client.query(`EXPLAIN QUERY PLAN ${query.sql}`).all(...(query.params as number[])) as {
      detail: string;
    }[];
    expect(plan.map((p) => p.detail)).toContain("SEARCH tournaments USING INDEX tournaments_end (end_date>?)");
  });

  test("upcomingBySlug: exact slug among tournaments that haven't ended, newest first", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("old", { url: "weekly", startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    repo.upsert(tournament("next", { url: "weekly" }));
    repo.upsert(tournament("after", { url: "weekly", startDate: NOW + 48 * HOUR, endDate: NOW + 50 * HOUR }));
    repo.upsert(tournament("other", { url: "weekly-2" }));
    expect(repo.upcomingBySlug("WEEKLY", NOW).map((t) => t.id)).toEqual(["after", "next"]);
  });

  test("delete removes the row and bumps the revision", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    const before = repo.revision;
    expect(repo.delete("1")).toBe(true);
    expect(repo.getById("1")).toBeUndefined();
    expect(repo.revision).toBeGreaterThan(before);
    expect(repo.delete("1")).toBe(false);
  });
});

describe("autocomplete choices", () => {
  test("name is `<slug> · <d MMM yyyy>` in Amsterdam time, value is the id", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("42", { url: "weekly-12", startDate: NOW, endDate: NOW + HOUR }));
    expect(buildChoices(repo.searchUpcoming("", NOW - 1, 25))).toEqual([
      { name: "weekly-12 · 16 Nov 2026", value: "42" },
    ]);
  });

  test("long slugs are cut so the name fits Discord's 100 characters, keeping the date", () => {
    const name = choiceName({ url: "x".repeat(200), startDate: NOW });
    expect(name).toHaveLength(MAX_CHOICE_NAME);
    expect(name.endsWith("… · 16 Nov 2026")).toBe(true);
    expect(choiceName({ url: "y".repeat(85), startDate: NOW })).toBe(`${"y".repeat(85)} · 16 Nov 2026`);
  });

  test("truncation never splits a surrogate pair", () => {
    const cut = truncate("a" + "😀".repeat(10), 6);
    expect(cut).toBe("a😀😀…");
    expect(cut.length).toBeLessThanOrEqual(6);
  });

  test("at most 25 choices", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      ...tournament(String(i)),
      participants: null,
      registrationClosesAt: null,
    }));
    expect(buildChoices(rows)).toHaveLength(25);
  });
});

describe("resolveTournament", () => {
  test("by id (a picked suggestion), refusing ended tournaments", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("1"));
    repo.upsert(tournament("past", { startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    expect(resolveTournament(repo, "1", NOW)).toMatchObject({ kind: "found", tournament: { id: "1" } });
    expect(resolveTournament(repo, "past", NOW)).toMatchObject({ kind: "ended", tournament: { id: "past" } });
  });

  test("typed text: exact slug among upcoming tournaments, newest first; otherwise not found", () => {
    const repo = memoryRepo();
    repo.upsert(tournament("next", { url: "weekly" }));
    repo.upsert(tournament("after", { url: "weekly", startDate: NOW + 48 * HOUR, endDate: NOW + 50 * HOUR }));
    repo.upsert(tournament("old", { url: "gone", startDate: NOW - 10 * HOUR, endDate: NOW - HOUR }));
    expect(resolveTournament(repo, "Weekly", NOW)).toMatchObject({ kind: "found", tournament: { id: "after" } });
    expect(resolveTournament(repo, "week", NOW)).toEqual({ kind: "not-found" });
    expect(resolveTournament(repo, "gone", NOW)).toEqual({ kind: "not-found" });
  });
});

/** A guild whose agenda channel and scheduled events record what was deleted. */
const fakeGuild = (
  opts: { messageError?: Error; eventError?: Error; channelError?: Error; noChannel?: boolean } = {},
) => {
  const deleteMessage = mock(async (_id: string) => {
    if (opts.messageError) {
      throw opts.messageError;
    }
  });
  const deleteEvent = mock(async (_id: string) => {
    if (opts.eventError) {
      throw opts.eventError;
    }
  });
  const fetchChannel = mock(async (_id: string) => {
    if (opts.channelError) {
      throw opts.channelError;
    }
    return opts.noChannel ? null : { isTextBased: () => true, messages: { delete: deleteMessage } };
  });
  const guild = { channels: { fetch: fetchChannel }, scheduledEvents: { delete: deleteEvent } } as unknown as Guild;
  return { guild, deleteMessage, deleteEvent, fetchChannel };
};

const channelIdFor = (t: { isOnline: boolean }) => (t.isOnline ? "online-agenda" : "agenda");

const posted = (repo: TournamentRepository, overrides: Partial<NormalizedTournament> = {}) => {
  repo.upsert(tournament("7", { title: "Weekly 12", messageID: "msg-1", guildEventID: "event-1", ...overrides }));
};

describe("deleteTournament", () => {
  test("happy path: message, event and row are removed", async () => {
    const repo = memoryRepo();
    posted(repo);
    const { guild, deleteMessage, deleteEvent, fetchChannel } = fakeGuild();
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");

    expect(result).toMatchObject({ ok: true, message: "deleted", event: "deleted" });
    expect(fetchChannel).toHaveBeenCalledWith("agenda");
    expect(deleteMessage).toHaveBeenCalledWith("msg-1");
    expect(deleteEvent).toHaveBeenCalledWith("event-1");
    expect(repo.getById("7")).toBeUndefined();
    expect(describeResult(result)).toBe(
      "Deleted **Weekly 12**: agenda message removed, event removed, removed from the agenda.",
    );
  });

  test("online tournaments are removed from the online agenda channel", async () => {
    const repo = memoryRepo();
    posted(repo, { isOnline: true, guildEventID: null });
    const { guild, fetchChannel, deleteEvent } = fakeGuild();
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: true, message: "deleted", event: "none" });
    expect(fetchChannel).toHaveBeenCalledWith("online-agenda");
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  test("a message that is already gone (10008) is fine", async () => {
    const repo = memoryRepo();
    posted(repo);
    const { guild } = fakeGuild({ messageError: apiError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message") });
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: true, message: "already-gone", event: "deleted" });
    expect(repo.getById("7")).toBeUndefined();
    expect(describeResult(result)).toContain("agenda message was already gone, event removed");
  });

  test("a missing agenda channel is fine", async () => {
    const repo = memoryRepo();
    posted(repo);
    const unknownChannel = fakeGuild({ channelError: apiError(RESTJSONErrorCodes.UnknownChannel, "Unknown Channel") });
    expect(await deleteTournament({ repo, guild: unknownChannel.guild, now: NOW, channelIdFor }, "7")).toMatchObject({
      ok: true,
      message: "already-gone",
    });

    posted(repo);
    const nullChannel = fakeGuild({ noChannel: true });
    expect(await deleteTournament({ repo, guild: nullChannel.guild, now: NOW, channelIdFor }, "7")).toMatchObject({
      ok: true,
      message: "already-gone",
    });
  });

  test("an event that is already gone (10070) is fine", async () => {
    const repo = memoryRepo();
    posted(repo);
    const { guild } = fakeGuild({
      eventError: apiError(RESTJSONErrorCodes.UnknownGuildScheduledEvent, "Unknown Guild Scheduled Event"),
    });
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: true, message: "deleted", event: "already-gone" });
    expect(repo.getById("7")).toBeUndefined();
  });

  test("a tournament saved without posting has nothing to remove in Discord", async () => {
    const repo = memoryRepo();
    posted(repo, { messageID: null, guildEventID: null });
    const { guild, fetchChannel } = fakeGuild();
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: true, message: "none", event: "none" });
    expect(fetchChannel).not.toHaveBeenCalled();
    expect(describeResult(result)).toContain("no agenda message, no event, removed from the agenda");
  });

  test("any other Discord error on the message keeps the row and touches nothing else", async () => {
    const repo = memoryRepo();
    posted(repo);
    const { guild, deleteEvent } = fakeGuild({
      messageError: apiError(RESTJSONErrorCodes.MissingPermissions, "Missing Permissions", 403),
    });
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: false, retryable: true });
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(repo.getById("7")).toBeDefined();
    expect(describeResult(result)).toBe(
      "Could not delete **Weekly 12**. Deleting the agenda message failed: Missing Permissions. " +
        "It is still on the agenda; run the command again to retry.",
    );
  });

  test("any other Discord error on the event keeps the row; a retry then finishes the job", async () => {
    const repo = memoryRepo();
    posted(repo);
    const failing = fakeGuild({
      eventError: apiError(RESTJSONErrorCodes.MissingPermissions, "Missing Permissions", 403),
    });
    const result = await deleteTournament({ repo, guild: failing.guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: false, retryable: true, message: "deleted" });
    expect(repo.getById("7")).toBeDefined();
    expect(describeResult(result)).toContain("The agenda message was removed. It is still on the agenda");

    const retry = fakeGuild({ messageError: apiError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message") });
    expect(await deleteTournament({ repo, guild: retry.guild, now: NOW, channelIdFor }, "7")).toMatchObject({
      ok: true,
      message: "already-gone",
      event: "deleted",
    });
    expect(repo.getById("7")).toBeUndefined();
  });

  test("ended tournaments are refused, without touching Discord", async () => {
    const repo = memoryRepo();
    posted(repo, { startDate: NOW - 10 * HOUR, endDate: NOW - HOUR });
    const { guild, fetchChannel, deleteEvent } = fakeGuild();
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(fetchChannel).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
    expect(repo.getById("7")).toBeDefined();
    expect(describeResult(result)).toBe(
      "Could not delete **Weekly 12**. It has already ended; past tournaments are kept.",
    );
  });

  test("a tournament deleted in the meantime is reported, not an error", async () => {
    const repo = memoryRepo();
    const { guild } = fakeGuild();
    const result = await deleteTournament({ repo, guild, now: NOW, channelIdFor }, "7");
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(describeResult(result)).toContain("no longer in the database");
  });
});

describe("confirmation", () => {
  test("shows title, slug, date and city, and what will be removed", () => {
    const repo = memoryRepo();
    posted(repo, { url: "weekly-12", startDate: NOW, endDate: NOW + HOUR });
    const text = confirmationText(repo.getById("7")!);
    expect(text).toBe(
      "Delete **Weekly 12** (`weekly-12`)?\n📅 16 Nov 2026 · Utrecht\n" +
        "This removes its agenda message, its Discord event, its entry on the website agenda. It can't be undone.",
    );
  });

  test("only the invoking admin can press the buttons", () => {
    const filter = onlyInvoker("admin-1");
    const reply = mock(async (_options: unknown) => undefined);
    const press = (userId: string) => ({ user: { id: userId }, reply }) as unknown as ButtonInteraction;

    expect(filter(press("admin-1"))).toBe(true);
    expect(reply).not.toHaveBeenCalled();

    expect(filter(press("someone-else"))).toBe(false);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0]).toEqual([
      expect.objectContaining({ content: "Only the admin who ran this command can answer it." }),
    ]);
  });
});
