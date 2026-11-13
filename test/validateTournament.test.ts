import { describe, expect, test } from "bun:test";
// @ts-ignore -- plain JS module from the /bot frontend
import { createValidators, validate } from "../public/src/validateTournament.js";

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const validState = () => ({
  url: "pgk-weekly-1",
  title: "PGK Weekly #1",
  startDate: iso(DAY),
  endDate: iso(DAY + 6 * 60 * 60 * 1000),
  isOnline: false,
  location: "Utrecht",
  city: "Utrecht",
  events: [{ name: "Ultimate Singles", cap: "64" }],
  nocap: false,
  description: "",
  prices: [{ name: "", amount: "" }],
});

const run = (state: ReturnType<typeof validState>) => validate(createValidators(state));

describe("validateTournament", () => {
  test("accepts a complete tournament", async () => {
    await expect(run(validState())).resolves.toBe(true);
  });

  test.each([
    ["Start.gg link is empty", { url: "" }],
    ["Title is empty", { title: "" }],
    ["Start Date is after End Date", { endDate: iso(DAY / 2) }],
    ["Start Date is before current date", { startDate: iso(-DAY) }],
    ["Location is empty", { location: "" }],
    ["The start.gg page does not contain a City", { city: "" }],
    ["Tournament needs at least 1 event", { events: [] }],
    ["At least one events needs an entry cap", { events: [{ name: "Singles", cap: "" }] }],
    ["Additional Notes cannot be longer than 250 characters", { description: "x".repeat(250) }],
    ["A price needs a value", { prices: [{ name: "1st", amount: "" }] }],
    ["A price needs a name", { prices: [{ name: "", amount: "50" }] }],
  ])("rejects with %p", async (message, patch) => {
    await expect(run({ ...validState(), ...patch } as ReturnType<typeof validState>)).rejects.toBe(message);
  });

  test("online tournaments need no location or city", async () => {
    await expect(run({ ...validState(), isOnline: true, location: "", city: "" })).resolves.toBe(true);
  });

  test("nocap skips the entry cap requirement", async () => {
    await expect(run({ ...validState(), nocap: true, events: [{ name: "Singles", cap: "" }] })).resolves.toBe(true);
  });
});
