import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { sClient } from "../src/Context";
import { deleteTournament } from "../src/commands/DeleteTournament";
import { store } from "../src/Store";
import { pendingTournamentLocks, withTournamentLock } from "../src/tournamentLock";
import { DISCORD_FAILED, EVENT_FAILED, postTournament } from "../src/web/actions/PostTournament/PostTournament";

/**
 * Posting a tournament twice (a double click, a retry after an error) must never leave a second
 * agenda message behind. Discord is faked: `sends` records every new message.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const apiError = (code: number, message: string, status = 404) =>
  new DiscordAPIError({ code, message }, code, status, "GET", "https://discord.test/x", {});

let sends: string[] = [];
let edits: string[] = [];
let eventsCreated = 0;
let nextMessage = 0;
let fetchError: Error | undefined;
let editError: Error | undefined;
let eventError: Error | undefined;
let eventFetchError: Error | undefined;
let eventEditError: Error | undefined;
let eventEdits: string[] = [];
let deletedMessages: string[] = [];

const channel = {
  isTextBased: () => true,
  send: async () => {
    // Slow enough that two concurrent posts overlap.
    await sleep(20);
    const id = `msg${++nextMessage}`;
    sends.push(id);
    return { id };
  },
  messages: {
    fetch: async (id: string) => {
      if (fetchError) {
        throw fetchError;
      }
      return {
        id,
        edit: async () => {
          await sleep(5);
          if (editError) {
            throw editError;
          }
          edits.push(id);
        },
      };
    },
    delete: async (id: string) => {
      deletedMessages.push(id);
    },
  },
};

const member = {
  roles: { cache: { has: () => true } },
  user: { username: "to", discriminator: "0", avatarURL: () => null },
};

const guild = {
  channels: { fetch: async () => channel },
  members: { fetch: async () => member },
  scheduledEvents: {
    create: async () => {
      if (eventError) {
        throw eventError;
      }
      eventsCreated++;
      return { id: `event${eventsCreated}` };
    },
    fetch: async (id: string) => {
      if (eventFetchError) {
        throw eventFetchError;
      }
      return {
        id,
        edit: async () => {
          if (eventEditError) {
            throw eventEditError;
          }
          eventEdits.push(id);
          return { id };
        },
      };
    },
    delete: async () => {},
  },
};

const START = Date.parse("2026-12-14T12:00:00Z");

const form = (id: number, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    url: `cup-${id}`,
    title: `Cup ${id}`,
    id,
    nocap: false,
    isOnline: false,
    startDate: START,
    endDate: Date.parse("2026-12-14T20:00:00Z"),
    location: "Teststraat 1",
    city: "Testdorp",
    events: [{ name: "Singles", cap: "" }],
    description: "",
    prices: [{ name: "", amount: 0 }],
    image: "",
    streamURL: "",
    streamStartDate: "",
    type: "smashgg",
    ...overrides,
  });

const withStream = { streamURL: "https://twitch.tv/test", streamStartDate: START };

/** The error a promise rejects with (fails the test if it resolves). */
const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error("expected the promise to reject");
};

const post = (body: string) => postTournament({ id: "1" } as never, { name: "posttournament", args: [body] });

beforeAll(() => {
  sClient.client = { guilds: { fetch: async () => guild } } as never;
  store.init({ create: true });
});

afterAll(() => {
  store.close();
});

beforeEach(() => {
  sends = [];
  edits = [];
  eventsCreated = 0;
  fetchError = undefined;
  editError = undefined;
  eventError = undefined;
  eventFetchError = undefined;
  eventEditError = undefined;
  eventEdits = [];
  deletedMessages = [];
});

describe("posting a tournament never sends a second agenda message", () => {
  test("two concurrent first posts send one message; the second edits it", async () => {
    const results = await Promise.all([post(form(1001)), post(form(1001))]);
    expect(results).toEqual(["Done", "Done"]);
    expect(sends).toEqual(["msg" + nextMessage]);
    expect(edits).toEqual(sends);
    expect(store.tournaments.getById("1001")?.messageID).toBe(sends[0]);
    expect(pendingTournamentLocks()).toBe(0);
  });

  test("concurrent posts of the same tournament with a stream create one event", async () => {
    await Promise.all([post(form(1002, withStream)), post(form(1002, withStream))]);
    expect(sends).toHaveLength(1);
    expect(eventsCreated).toBe(1);
    expect(store.tournaments.getById("1002")?.guildEventID).toBe("event1");
  });

  test("a failed event keeps the message id, says the post succeeded, and a retry edits", async () => {
    eventError = new Error("Cannot schedule event in the past");
    expect(await post(form(1003, withStream))).toBe(EVENT_FAILED);
    expect(sends).toHaveLength(1);
    const stored = store.tournaments.getById("1003");
    expect(stored?.messageID).toBe(sends[0]);
    expect(stored?.guildEventID).toBeNull();

    eventError = undefined;
    expect(await post(form(1003, withStream))).toBe("Done");
    expect(sends).toHaveLength(1);
    expect(edits).toEqual(sends);
    expect(store.tournaments.getById("1003")?.guildEventID).toBe("event1");
  });

  test("a failed edit is reported and doesn't send a new message", async () => {
    await post(form(1004));
    expect(sends).toHaveLength(1);
    const messageID = sends[0];

    editError = apiError(RESTJSONErrorCodes.MissingPermissions, "Missing Permissions", 403);
    expect((await rejection(post(form(1004)))).message).toBe(DISCORD_FAILED);
    expect(sends).toHaveLength(1);
    expect(store.tournaments.getById("1004")?.messageID).toBe(messageID);
  });

  test("a failed fetch other than Unknown Message doesn't send a new message", async () => {
    await post(form(1005));
    fetchError = apiError(RESTJSONErrorCodes.MissingAccess, "Missing Access", 403);
    expect((await rejection(post(form(1005)))).message).toBe(DISCORD_FAILED);
    expect(sends).toHaveLength(1);
  });

  test("a deleted message is posted anew and its new id stored", async () => {
    await post(form(1006));
    fetchError = apiError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message");
    expect(await post(form(1006))).toBe("Done");
    expect(sends).toHaveLength(2);
    expect(store.tournaments.getById("1006")?.messageID).toBe(sends[1]);
  });

  test("a cached message whose edit says Unknown Message is posted anew", async () => {
    await post(form(1007));
    editError = apiError(RESTJSONErrorCodes.UnknownMessage, "Unknown Message");
    expect(await post(form(1007))).toBe("Done");
    expect(sends).toHaveLength(2);
    expect(store.tournaments.getById("1007")?.messageID).toBe(sends[1]);
  });

  test("details the embed refuses are still reported as invalid details", async () => {
    // The embed needs at least one named event.
    const error = await rejection(post(form(1008, { events: [{ name: "", cap: "" }] })));
    expect(error.message).toBe("Invalid Tournament Details.");
    expect(sends).toHaveLength(0);
  });
});

describe("the stream event is never duplicated", () => {
  test("a failed event edit is reported as a failed event, not as done", async () => {
    await post(form(1101, withStream));
    eventEditError = apiError(RESTJSONErrorCodes.MissingPermissions, "Missing Permissions", 403);
    expect(await post(form(1101, withStream))).toBe(EVENT_FAILED);
    expect(eventsCreated).toBe(1);
    expect(store.tournaments.getById("1101")?.guildEventID).toBe("event1");
  });

  test("a failed event fetch other than Unknown Event doesn't create a second event", async () => {
    await post(form(1102, withStream));
    eventFetchError = apiError(RESTJSONErrorCodes.MissingAccess, "Missing Access", 403);
    expect(await post(form(1102, withStream))).toBe(EVENT_FAILED);
    expect(eventsCreated).toBe(1);
  });

  test("a deleted event is created anew and its new id stored", async () => {
    await post(form(1103, withStream));
    eventFetchError = apiError(RESTJSONErrorCodes.UnknownGuildScheduledEvent, "Unknown Guild Scheduled Event");
    expect(await post(form(1103, withStream))).toBe("Done");
    expect(eventsCreated).toBe(2);
    expect(store.tournaments.getById("1103")?.guildEventID).toBe("event2");
  });
});

describe("deleting a tournament", () => {
  test("waits for a post of the same tournament, then removes its message and row", async () => {
    const posting = post(form(1201));
    while (pendingTournamentLocks() === 0) {
      await sleep(1);
    }
    const deletion = deleteTournament(
      {
        repo: store.tournaments,
        guild: guild as never,
        now: Date.parse("2026-11-18T00:00:00Z"),
        channelIdFor: () => "agenda",
      },
      "1201",
    );
    expect(await posting).toBe("Done");
    expect(await deletion).toMatchObject({ ok: true, message: "deleted" });
    expect(deletedMessages).toEqual(sends);
    expect(store.tournaments.getById("1201")).toBeUndefined();
    expect(pendingTournamentLocks()).toBe(0);
  });
});

describe("withTournamentLock", () => {
  test("runs one tournament's work in order, other tournaments in parallel, and releases on error", async () => {
    const order: string[] = [];
    const work =
      (name: string, ms: number, fail = false) =>
      async () => {
        order.push(`start ${name}`);
        await sleep(ms);
        order.push(`end ${name}`);
        if (fail) {
          throw new Error(name);
        }
        return name;
      };
    const a1 = withTournamentLock("a", work("a1", 20, true));
    const a2 = withTournamentLock("a", work("a2", 1));
    const b1 = withTournamentLock("b", work("b1", 1));
    expect(pendingTournamentLocks()).toBe(2);

    expect((await rejection(a1)).message).toBe("a1");
    expect(await a2).toBe("a2");
    expect(await b1).toBe("b1");
    expect(order).toEqual(["start a1", "start b1", "end b1", "end a1", "start a2", "end a2"]);
    expect(pendingTournamentLocks()).toBe(0);
  });
});
