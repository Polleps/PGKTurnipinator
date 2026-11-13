import { describe, expect, test } from "bun:test";
import { ActionError, actionErrorResponse } from "../src/web/actions/ActionError";
import { MISSING_START_GG_ID, postTournament } from "../src/web/actions/PostTournament/PostTournament";

// A post as public/src/tournamentFormat.js sends it, before a start.gg lookup set the id.
const form = (overrides: Record<string, unknown> = {}) => ({
  url: "fixture-cup",
  title: "Fixture Cup",
  id: "0",
  nocap: false,
  isOnline: false,
  startDate: Date.parse("2026-03-14T12:00:00Z"),
  endDate: Date.parse("2026-03-14T20:00:00Z"),
  location: "Teststraat 1, Testdorp",
  city: "Testdorp",
  events: [{ name: "Singles", cap: "" }],
  description: "",
  prices: [{ name: "", amount: 0 }],
  image: "",
  streamURL: "",
  streamStartDate: "",
  type: "smashgg",
  error: "",
  ...overrides,
});

const post = (body: unknown) =>
  postTournament({ id: "1" } as never, { name: "posttournament", args: [JSON.stringify(body)] });

describe("posting a tournament: validation happens before Discord", () => {
  // These reject before the Discord client (unset in tests) is ever touched.
  test.each([["0"], [0], [""], [-3], [null]])("id %p is refused with a 400 telling the user what to do", async (id) => {
    const error = await post(form({ id })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ActionError);
    expect((error as ActionError).message).toBe(MISSING_START_GG_ID);
    expect(actionErrorResponse(error)).toEqual({ status: 400, body: { error: true, message: MISSING_START_GG_ID } });
  });

  test("other invalid details name the problem", async () => {
    const error = await post(form({ id: 900100, title: "" })).catch((e: unknown) => e);
    expect(actionErrorResponse(error)).toEqual({
      status: 400,
      body: { error: true, message: "Invalid Tournament Details: missing title." },
    });
  });

  test("unparseable JSON and missing args are 400s", async () => {
    const bad = await postTournament({ id: "1" } as never, { name: "posttournament", args: ["{"] }).catch((e: unknown) => e);
    expect(actionErrorResponse(bad).status).toBe(400);
    const none = await postTournament({ id: "1" } as never, { name: "posttournament" }).catch((e: unknown) => e);
    expect(actionErrorResponse(none).status).toBe(400);
  });

  test("other failures keep the old 200 + error: true answer", () => {
    expect(actionErrorResponse(new Error("Discord is down"))).toEqual({
      status: 200,
      body: { error: true, message: "Discord is down" },
    });
  });
});
