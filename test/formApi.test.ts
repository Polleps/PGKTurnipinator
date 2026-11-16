import { describe, expect, test } from "bun:test";
import { parseDetailsResponse, parseMeResponse, parsePostResponse } from "../public/src/lib/api";
import { loginURL } from "../public/src/lib/session";
import { MISSING_START_GG_ID } from "../src/web/actions/PostTournament/PostTournament";

describe("posting: server answers", () => {
  test("success", () => {
    expect(parsePostResponse(200, { message: "Done" })).toEqual({ ok: true, value: "Done" });
  });

  test("a 400 shows the server's message as-is", () => {
    expect(parsePostResponse(400, { error: true, message: MISSING_START_GG_ID })).toEqual({
      ok: false,
      message: MISSING_START_GG_ID,
    });
    // The auth middleware's 400 has no `error` flag; the old form showed "Tournament Posted" for it.
    expect(parsePostResponse(400, { message: "Could not authenticate." })).toEqual({
      ok: false,
      message: "Could not authenticate.",
    });
  });

  test("other failures are server errors", () => {
    expect(parsePostResponse(200, { error: true, message: "Invalid Tournament Details." })).toEqual({
      ok: false,
      message: "Server Error: Invalid Tournament Details.",
    });
    expect(parsePostResponse(502, undefined)).toEqual({
      ok: false,
      message: "Server Error: The server answered with HTTP 502.",
    });
  });
});

describe("start.gg lookup: server answers", () => {
  const data = { id: 1, name: "Cup", events: [], startAt: 0, endAt: 0, isOnline: false, image: "" };

  test("success", () => {
    expect(parseDetailsResponse(200, { message: "success", data })).toEqual({ ok: true, value: data });
  });

  test("errors show the server's message", () => {
    expect(parseDetailsResponse(400, { message: "invalid tournament", error: true })).toEqual({
      ok: false,
      message: "invalid tournament",
    });
    expect(parseDetailsResponse(400, { message: "Could not authenticate." })).toEqual({
      ok: false,
      message: "Could not authenticate.",
    });
    expect(parseDetailsResponse(500, undefined)).toEqual({ ok: false, message: "The server answered with HTTP 500." });
  });
});

describe("login state", () => {
  test("GET /me: a user, nobody (401), or an error", () => {
    expect(parseMeResponse(200, { id: "1", username: "u", global_name: "U" })).toEqual({
      ok: true,
      value: { id: "1", username: "u", global_name: "U" },
    });
    expect(parseMeResponse(200, { id: "1", username: "u" })).toEqual({
      ok: true,
      value: { id: "1", username: "u", global_name: null },
    });
    expect(parseMeResponse(401, { error: true, message: "not logged in" })).toEqual({ ok: true, value: null });
    expect(parseMeResponse(502, undefined)).toEqual({ ok: false, message: "The server answered with HTTP 502." });
  });

  test("a 401 while posting shows the server's message", () => {
    expect(parsePostResponse(401, { error: true, message: "Please log in again." })).toEqual({
      ok: false,
      message: "Please log in again.",
    });
  });

  test("the login link carries the remember choice", () => {
    expect(loginURL(true)).toBe("/auth/login?remember=1");
    expect(loginURL(false)).toBe("/auth/login");
  });
});
