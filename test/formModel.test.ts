import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  applyStartGG,
  cleanStreamInput,
  extractSlug,
  initialFormState,
  postTournamentAction,
  shortenEventName,
  toRequestBody,
  type FormState,
  type StartGGDetails,
} from "../public/src/lib/formModel";
import { normalizeTournament } from "../src/db/normalizeTournament";
// @ts-ignore -- frozen plain-JS copy of the old form's helpers
import { convertToITournament, getStreamURL, parseDate } from "./fixtures/legacy-form/tournamentFormat.js";

// The old form used the browser's time zone; compare as a browser in the Netherlands.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Amsterdam";
});
afterAll(() => {
  process.env.TZ = originalTZ;
});

const details = (overrides: Partial<StartGGDetails> = {}): StartGGDetails => ({
  id: 900100,
  name: "Fixture Cup #3",
  isOnline: false,
  mapsPlaceId: "ChIJ-place",
  address: "Teststraat 1, Utrecht",
  city: "Utrecht",
  startAt: Date.parse("2026-03-14T11:00:00Z") / 1000,
  endAt: Date.parse("2026-03-14T20:30:00Z") / 1000,
  events: ["Super Smash Bros. Ultimate Singles", "Doubles"],
  image: "https://images.start.gg/images/tournament/1/image.png",
  streams: [{ streamName: "pgkstream", streamSource: "TWITCH" }],
  ...overrides,
});

/** What the old PostTournament did: its constructor's state, then fetchTournament(). */
const legacyFilledState = (slug: string, data: StartGGDetails) => {
  const shortenName = (name: string) => name.replace("Super Smash Bros.", "").trim();
  const constructed: Record<string, unknown> = {
    url: slug,
    title: "",
    id: "0",
    nocap: false,
    isOnline: false,
    startDate: "",
    endDate: "",
    location: "",
    city: "",
    events: [{ name: "", cap: "", key: "1" }],
    description: "",
    prices: [{ name: "", amount: "", key: "2" }],
    image: "",
    streamURL: "",
    streamStartDate: "",
  };
  return {
    ...constructed,
    error: "",
    id: data.id,
    isOnline: data.isOnline,
    title: data.name,
    location: data.address,
    startDate: parseDate(new Date(data.startAt * 1000)),
    endDate: parseDate(new Date(data.endAt * 1000)),
    events: data.events.map((evt, i) => ({ name: shortenName(evt), cap: "", key: `e${i}` })),
    image: data.image,
    city: data.city,
    locationID: data.mapsPlaceId,
    ...getStreamURL(data.streams, parseDate(new Date(data.startAt * 1000))),
  };
};

/** The old body as the server saw it: JSON round trip, minus the form-only `error` key the server drops. */
const legacyBody = (state: Record<string, unknown>) => {
  const { error: _error, ...body } = JSON.parse(JSON.stringify(convertToITournament(state)));
  return body;
};
const newBody = (state: FormState) => JSON.parse(postTournamentAction(state).args[0]);

type Edit = (s: Record<string, unknown> & { events: Array<{ name: string; cap: string }> }) => void;

/** Applies the same user edits to the old and the new state. */
const both = (data: StartGGDetails, edit: Edit = () => {}) => {
  const legacy = legacyFilledState("fixture-cup-3", data) as Parameters<Edit>[0];
  const next = structuredClone(
    applyStartGG(initialFormState(), "fixture-cup-3", data),
  ) as unknown as Parameters<Edit>[0];
  edit(legacy);
  edit(next);
  return { legacy: legacyBody(legacy), next: newBody(next as unknown as FormState) };
};

describe("request body: same as the old lit-html form", () => {
  test.each<[string, StartGGDetails, Edit]>([
    ["start.gg defaults, caps filled in", details(), (s) => (s.events[0].cap = "64")],
    [
      "edited title, notes, nocap and dates",
      details(),
      (s) => {
        s.title = "Renamed Cup";
        s.description = "Bring a GameCube controller";
        s.nocap = true;
        s.startDate = "2026-07-04T10:15";
        s.endDate = "2026-07-05T02:00";
      },
    ],
    [
      "online, no stream from start.gg, stream typed in",
      details({ isOnline: true, streams: [], address: "", city: "" }),
      (s) => {
        s.streamURL = "twitch.tv/other";
        s.streamStartDate = "2026-03-14T13:00";
        s.events[1].cap = "32";
      },
    ],
    [
      "stream URL cleared, start time left (no stream stored)",
      details(),
      (s) => {
        s.streamURL = "";
        s.events[0].cap = "16";
      },
    ],
    [
      "an event added and one removed",
      details(),
      (s) => {
        s.events.push({ name: "Melee", cap: "24" });
        s.events.splice(0, 1);
      },
    ],
    [
      "across the DST switch",
      details({ startAt: Date.parse("2026-10-24T12:00:00Z") / 1000, endAt: Date.parse("2026-10-25T12:00:00Z") / 1000 }),
      () => {},
    ],
  ])("%s", (_name, data, edit) => {
    const { legacy, next } = both(data, edit);
    expect(next).toEqual(legacy);
  });

  test('a non-Twitch stream: the old form sent no streamURL key, the new one sends "" (both: no stream)', () => {
    const { legacy, next } = both(details({ streams: [{ streamName: "x", streamSource: "YOUTUBE" }] }));
    expect(legacy.streamURL).toBeUndefined();
    expect(next.streamURL).toBe("");
    const { streamURL: _a, ...legacyRest } = legacy;
    const { streamURL: _b, ...nextRest } = next;
    expect(nextRest).toEqual(legacyRest);
  });

  test("the body is an action the server accepts, with dates as epoch ms", () => {
    const state = { ...applyStartGG(initialFormState(), "fixture-cup-3", details()) };
    const action = postTournamentAction(state);
    expect(action.name).toBe("posttournament");
    expect(action.args).toHaveLength(1);
    const body = JSON.parse(action.args[0]);
    expect(body).toMatchObject({
      id: 900100,
      url: "fixture-cup-3",
      startDate: Date.parse("2026-03-14T11:00:00Z"),
      endDate: Date.parse("2026-03-14T20:30:00Z"),
      streamURL: "https://twitch.tv/pgkstream",
      streamStartDate: Date.parse("2026-03-14T11:00:00Z"),
      type: "smashgg",
    });
    const normalized = normalizeTournament(body);
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.row).toMatchObject({
        id: "900100",
        title: "Fixture Cup #3",
        location: "Teststraat 1, Utrecht",
        locationID: "ChIJ-place",
        events: [
          { name: "Ultimate Singles", cap: "" },
          { name: "Doubles", cap: "" },
        ],
        prices: [],
        streamURL: "https://twitch.tv/pgkstream",
        streamStartDate: Date.parse("2026-03-14T11:00:00Z"),
      });
    }
  });

  test('before a start.gg lookup the id is "0", which the server refuses', () => {
    const body = toRequestBody({ ...initialFormState(), url: "x", title: "T", startDate: "2026-03-14T12:00" });
    expect(body.id).toBe("0");
    expect(normalizeTournament(body)).toMatchObject({ ok: false, badId: true });
  });

  test('an online tournament without address/city sends "" (the old form sent null)', () => {
    const state = applyStartGG(
      initialFormState(),
      "online-cup",
      details({ isOnline: true, address: null, city: null }),
    );
    expect(toRequestBody(state)).toMatchObject({ isOnline: true, location: "", city: "" });
  });
});

describe("applyStartGG", () => {
  test("re-filling replaces events and the stream, keeps notes and nocap", () => {
    const first = applyStartGG(initialFormState(), "a", details());
    const edited: FormState = { ...first, description: "notes", nocap: true };
    const second = applyStartGG(edited, "b", details({ id: 5, streams: null, events: ["Melee Singles"] }));
    expect(second).toMatchObject({
      url: "b",
      id: 5,
      description: "notes",
      nocap: true,
      streamURL: "",
      streamStartDate: "",
    });
    expect(second.events.map((e) => e.name)).toEqual(["Melee Singles"]);
  });

  test("dates are shown in Amsterdam time", () => {
    const s = applyStartGG(initialFormState(), "a", details());
    expect([s.startDate, s.endDate, s.streamStartDate]).toEqual([
      "2026-03-14T12:00",
      "2026-03-14T21:30",
      "2026-03-14T12:00",
    ]);
  });
});

describe("start.gg link", () => {
  test.each([
    ["https://www.start.gg/tournament/fixture-cup-3/details", { slug: "fixture-cup-3" }],
    ["https://start.gg/tournament/fixture-cup-3", { slug: "fixture-cup-3" }],
    ["https://smash.gg/tournament/old-cup/events/ultimate", { slug: "old-cup" }],
    ["fixture-cup-3", { slug: "fixture-cup-3" }],
    ["  fixture-cup-3 ", { slug: "fixture-cup-3" }],
    ["", { slug: "" }],
    ["https://www.start.gg/", { error: "Invalid Link" }],
    ["https://www.start.gg/league/x/details", { error: "Invalid Link" }],
    ["https://www.start.gg/tournament/", { error: "Invalid Link" }],
  ])("%p", (link, expected) => {
    expect(extractSlug(link)).toEqual(expected);
  });

  test("event names lose the series prefix", () => {
    expect(shortenEventName("Super Smash Bros. Ultimate Singles")).toBe("Ultimate Singles");
  });

  test("the stream field is lower-cased and trimmed", () => {
    expect(cleanStreamInput("  Twitch.tv/PGK ")).toBe("twitch.tv/pgk");
  });
});
