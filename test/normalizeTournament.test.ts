import { describe, expect, test } from "bun:test";
import {
  normalizeStreamURL,
  normalizeTournament,
  parseAmsterdamLocalDateTime,
  type DefaultedField,
  type NormalizedTournament,
} from "../src/db/normalizeTournament";

// Synthetic docs in the shapes the Firestore export holds (see the defaults table in the
// normalizer's docs). No real data.

const START = Date.parse("2026-03-14T12:00:00Z");
const END = Date.parse("2026-03-14T20:00:00Z");

/** A doc as the current form posts it (the conforming shape). */
const current = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "900100",
  url: "fixture-cup",
  title: "Fixture Cup",
  image: "https://images.example.test/a.png",
  description: "",
  location: "Teststraat 1, Testdorp",
  city: "Testdorp",
  locationID: "place-1",
  startDate: START,
  endDate: END,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "64" }],
  prices: [{ name: "Entree", amount: 5 }],
  streamURL: "https://twitch.tv/fixture",
  streamStartDate: START - 30 * 60 * 1000,
  messageID: "300000000000000001",
  guildEventID: "400000000000000001",
  ...overrides,
});

const without = (doc: Record<string, unknown>, ...keys: string[]) =>
  Object.fromEntries(Object.entries(doc).filter(([k]) => !keys.includes(k)));

const ok = (doc: unknown) => {
  const result = normalizeTournament(doc);
  if (!result.ok) {
    throw new Error(`expected ok, got quarantine: ${result.reason}`);
  }
  return result;
};

describe("normalizeTournament: a conforming doc", () => {
  test("is stored as is, with no defaults", () => {
    const result = ok(current());
    expect(result.defaulted).toEqual([]);
    expect(result.droppedKeys).toEqual([]);
    expect(result.row).toEqual(current() as unknown as NormalizedTournament);
  });
});

describe("normalizeTournament: quarantine", () => {
  test.each<[string, unknown, string]>([
    ["an empty doc", {}, "missing id, url, title, startDate"],
    ["not an object", "x", "not an object"],
    ["no id", without(current(), "id"), "missing id"],
    ["a blank id", current({ id: " " }), "missing id"],
    ["a non-integer id", current({ id: 1.5 }), "missing id"],
    ["no url", current({ url: "" }), "missing url"],
    ["no title", without(current(), "title"), "missing title"],
    ["a non-date startDate", current({ startDate: "2026-03-14" }), "missing startDate"],
  ])("%s", (_, doc, reason) => {
    expect(normalizeTournament(doc)).toEqual({ ok: false, reason });
  });
});

describe("normalizeTournament: defaults (table)", () => {
  type Row = [string, Record<string, unknown>, Partial<NormalizedTournament>, DefaultedField[]];
  const cases: Row[] = [
    ["numeric id (start.gg sends a number)", current({ id: 900100 }), { id: "900100" }, ["id"]],
    ["missing endDate → startDate", without(current(), "endDate"), { endDate: START }, ["endDate"]],
    ["endDate before startDate → startDate", current({ endDate: START - 1 }), { endDate: START }, ["endDate"]],
    ["missing image/description → \"\"", without(current(), "image", "description"), { image: "", description: "" }, ["image", "description"]],
    [
      "online post with null location fields → \"\"",
      current({ isOnline: true, location: null, city: null, locationID: null }),
      { isOnline: true, location: "", city: "", locationID: "" },
      ["location", "city", "locationID"],
    ],
    ["missing location → \"\"", without(current(), "location"), { location: "" }, ["location"]],
    ["unknown type → smashgg", current({ type: "weird" }), { type: "smashgg" }, ["type"]],
    ["pre-2020-10: no isOnline/nocap/messageID", without(current(), "isOnline", "nocap", "messageID"), { isOnline: false, nocap: false, messageID: null }, ["isOnline", "nocap", "messageID"]],
    ["pr missing → false", without(current(), "pr"), { pr: false }, ["pr"]],
    ["pr true is kept", current({ pr: true }), { pr: true }, []],
    ["events missing → []", without(current(), "events"), { events: [] }, ["events"]],
    [
      "blank-named events are dropped, caps kept as strings",
      current({ events: [{ name: "Singles", cap: "" }, { name: " ", cap: "8" }, { name: "Doubles", cap: 32 }] }),
      { events: [{ name: "Singles", cap: "" }, { name: "Doubles", cap: "32" }] },
      ["events"],
    ],
    ["prices missing → []", without(current(), "prices"), { prices: [] }, ["prices"]],
    ["the form's blank price line is dropped", current({ prices: [{ name: "", amount: 0 }] }), { prices: [] }, ["prices"]],
    ["a named price with amount 0 is kept", current({ prices: [{ name: "Venue", amount: 0 }] }), { prices: [{ name: "Venue", amount: 0 }] }, []],
    [
      "local streamStartDate → ms in Europe/Amsterdam (summer, UTC+2)",
      current({ streamStartDate: "2023-07-01T16:00" }),
      { streamStartDate: Date.parse("2023-07-01T14:00:00Z") },
      ["streamStartDate"],
    ],
    [
      "local streamStartDate → ms in Europe/Amsterdam (winter, UTC+1)",
      current({ streamStartDate: "2023-01-07T16:00" }),
      { streamStartDate: Date.parse("2023-01-07T15:00:00Z") },
      ["streamStartDate"],
    ],
    [
      "scheme-less twitch URL gets https://",
      current({ streamURL: "twitch.tv/fixture" }),
      { streamURL: "https://twitch.tv/fixture" },
      ["streamURL"],
    ],
    [
      "not a URL → no stream",
      current({ streamURL: "watch it on our channel" }),
      { streamURL: null, streamStartDate: null },
      ["streamURL", "streamStartDate"],
    ],
    ["\"\"/\"\" stream pair → both NULL", current({ streamURL: "", streamStartDate: "" }), { streamURL: null, streamStartDate: null }, ["streamURL", "streamStartDate"]],
    ["URL with \"\" start → both NULL", current({ streamStartDate: "" }), { streamURL: null, streamStartDate: null }, ["streamStartDate", "streamURL"]],
    ["\"\" URL with a local start → both NULL", current({ streamURL: "", streamStartDate: "2024-01-01T12:00" }), { streamURL: null, streamStartDate: null }, ["streamURL", "streamStartDate"]],
    ["pre-2022: no stream keys → both NULL", without(current(), "streamURL", "streamStartDate", "guildEventID"), { streamURL: null, streamStartDate: null, guildEventID: null }, ["streamURL", "streamStartDate", "guildEventID"]],
    [
      "Firestore timestamps → ms",
      current({ startDate: { toMillis: () => START }, endDate: new Date(END) }),
      { startDate: START, endDate: END },
      [],
    ],
  ];

  test.each(cases)("%s", (_, doc, expected, defaulted) => {
    const result = ok(doc);
    expect(result.row).toMatchObject(expected);
    expect([...result.defaulted].sort()).toEqual([...defaulted].sort());
  });
});

describe("normalizeTournament: dropped and refresh-owned keys", () => {
  test("form leftovers and legacy keys are dropped", () => {
    const result = ok(current({ error: "", smashggID: "1", lat: 52, lng: 5, key: 3 }));
    expect(result.droppedKeys.sort()).toEqual(["error", "key", "lat", "lng", "smashggID"]);
    expect(result.row).not.toHaveProperty("error");
    expect(result.row).not.toHaveProperty("lat");
  });

  test("participants and registrationClosesAt never come from input", () => {
    const result = ok(current({ participants: 12, registrationClosesAt: 1 }));
    expect(result.row).not.toHaveProperty("participants");
    expect(result.row).not.toHaveProperty("registrationClosesAt");
    expect(result.droppedKeys).toEqual([]);
  });
});

describe("parseAmsterdamLocalDateTime", () => {
  test.each<[string, number | undefined]>([
    ["2026-03-29T01:30", Date.parse("2026-03-29T00:30:00Z")], // before the spring-forward switch
    ["2026-03-29T03:30", Date.parse("2026-03-29T01:30:00Z")], // after it
    ["2026-03-29T02:30", undefined], // doesn't exist
    ["2026-10-25T12:00:30", Date.parse("2026-10-25T11:00:30Z")],
    ["2026-02-30T12:00", undefined],
    ["2026-01-01", undefined],
    ["", undefined],
  ])("%s", (value, expected) => {
    expect(parseAmsterdamLocalDateTime(value)).toBe(expected);
  });
});

describe("normalizeStreamURL", () => {
  test.each<[string, ReturnType<typeof normalizeStreamURL>]>([
    ["https://twitch.tv/x", { url: "https://twitch.tv/x", prefixed: false }],
    ["https://www.twitch.tv/x", { url: "https://www.twitch.tv/x", prefixed: false }],
    ["twitch.tv/x", { url: "https://twitch.tv/x", prefixed: true }],
    ["www.twitch.tv/x", { url: "https://www.twitch.tv/x", prefixed: true }],
    ["fixture", undefined],
    ["watch at https://twitch.tv/x", undefined],
    ["ftp://twitch.tv/x", undefined],
    ["", undefined],
  ])("%s", (value, expected) => {
    expect(normalizeStreamURL(value)).toEqual(expected);
  });
});
