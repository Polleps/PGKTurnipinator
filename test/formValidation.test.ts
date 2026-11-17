import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initialFormState, type FormState } from "../public/src/lib/formModel";
import { toLocalInput } from "../public/src/lib/dates";
import { LINK_CHANGED, NOT_LOADED, hasStartGGId, isValidStreamURL, validateForm } from "../public/src/lib/validation";
import { normalizeStreamURL } from "../src/db/normalizeTournament";
// @ts-ignore -- frozen plain-JS copy of the old form's validation
import { createValidators, validate } from "./fixtures/legacy-form/validateTournament.js";

// The old validation parsed dates in the browser's zone; compare as a browser in the Netherlands.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Amsterdam";
});
afterAll(() => {
  process.env.TZ = originalTZ;
});

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) => toLocalInput(Date.now() + offsetMs);

const validState = (): FormState => ({
  ...initialFormState(),
  url: "pgk-weekly-1",
  id: 900100,
  title: "PGK Weekly #1",
  startDate: at(DAY),
  endDate: at(DAY + 6 * 60 * 60 * 1000),
  location: "Utrecht",
  city: "Utrecht",
  events: [{ key: "a", name: "Ultimate Singles", cap: "64" }],
});

const check = (state: FormState, linkSlug = state.url) => validateForm(state, { linkSlug });
const legacy = (state: FormState): Promise<string | undefined> =>
  validate(createValidators(state)).then(
    () => undefined,
    (message: string) => message,
  );

/** Each old check, with the patch that makes it fail. */
const oldCases: Array<[string, Partial<FormState>]> = [
  ["Start.gg link is empty", { url: "" }],
  ["Title is empty", { title: "" }],
  ["Start Date is empty", { startDate: "" }],
  ["End Date is empty", { endDate: "" }],
  ["Start Date is after End Date", { endDate: at(DAY / 2) }],
  ["Start Date is before current date", { startDate: at(-DAY), endDate: at(DAY) }],
  ["Location is empty", { location: "" }],
  ["The start.gg page does not contain a City", { city: "" }],
  ["Tournament needs at least 1 event", { events: [] }],
  ["At least one events needs an entry cap", { events: [{ key: "a", name: "Singles", cap: "" }] }],
  ["At least one events needs an entry cap", { events: [{ key: "a", name: "Singles", cap: "0" }] }],
  ["Additional Notes cannot be longer than 250 characters", { description: "x".repeat(250) }],
  ["A price needs a value", { prices: [{ key: "p", name: "1st", amount: "" }] }],
  ["A price needs a name", { prices: [{ key: "p", name: "", amount: "50" }] }],
];

describe("form validation: the old checks", () => {
  test("accepts a complete tournament, like the old form", async () => {
    expect(check(validState())).toBeUndefined();
    expect(await legacy(validState())).toBeUndefined();
  });

  test.each(oldCases)("%p, with the same message as the old form", async (message, patch) => {
    const state = { ...validState(), ...patch };
    const linkSlug = state.url; // the old form validated the link field's slug
    expect(validateForm(state, { linkSlug })).toBe(message);
    expect(await legacy(state)).toBe(message);
  });

  test("online tournaments need no location or city", () => {
    expect(check({ ...validState(), isOnline: true, location: "", city: "" })).toBeUndefined();
  });

  test("nocap skips the entry cap requirement", () => {
    expect(check({ ...validState(), nocap: true, events: [{ key: "a", name: "Singles", cap: "" }] })).toBeUndefined();
  });

  test("notes of 249 characters are fine", () => {
    expect(check({ ...validState(), description: "x".repeat(249) })).toBeUndefined();
  });
});

describe("form validation: new checks", () => {
  test("refuses to post before a start.gg lookup set the id", () => {
    expect(check({ ...validState(), id: "0" })).toBe(NOT_LOADED);
  });

  test("refuses to post when the link changed after the lookup", () => {
    expect(check(validState(), "another-tournament")).toBe(LINK_CHANGED);
  });

  test("a start time in the DST gap is refused instead of silently moved", () => {
    const state = { ...validState(), startDate: "2099-03-29T02:30", endDate: "2099-03-29T20:00" };
    expect(check(state)).toBe("Start Date does not exist in Dutch time (daylight saving time starts then)");
  });

  test("stream URLs: what the server would drop is refused, the rest passes", () => {
    expect(check({ ...validState(), streamURL: "twitch.tv/pgk", streamStartDate: at(DAY) })).toBeUndefined();
    expect(check({ ...validState(), streamURL: "https://user:pw@twitch.tv/pgk" })).toBe(
      "Stream URL is not a valid link",
    );
    expect(check({ ...validState(), streamURL: "pgk" })).toBe("Stream URL is not a valid link");
  });

  test.each([
    ["twitch.tv/pgk"],
    ["https://twitch.tv/pgk"],
    ["http://twitch.tv/pgk"],
    ["//twitch.tv/pgk"],
    ["https://user:pw@twitch.tv/pgk"],
    ["https://user@twitch.tv/pgk"],
    ["ftp://twitch.tv/pgk"],
    ["javascript:alert(1)"],
    ["pgk"],
    ["twitch tv"],
    ["localhost:8080/x"],
    [""],
  ])("stream URL %p: same verdict as the server's normalizeStreamURL", (url) => {
    expect(isValidStreamURL(url)).toBe(normalizeStreamURL(url) !== undefined);
  });

  test.each([
    [900100, true],
    ["900100", true],
    ["0", false],
    [0, false],
    ["", false],
    [-3, false],
    ["12a", false],
    [1.5, false],
  ])("start.gg id %p loaded: %p", (id, expected) => {
    expect(hasStartGGId(id)).toBe(expected);
  });
});
