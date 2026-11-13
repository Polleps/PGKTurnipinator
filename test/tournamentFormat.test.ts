import { describe, expect, test } from "bun:test";
// @ts-ignore -- plain JS module from the /bot frontend
import { convertToITournament, getStreamURL, parseDate } from "../public/src/tournamentFormat.js";

describe("parseDate (datetime-local input format)", () => {
  test("formats local time as YYYY-MM-DDTHH:mm with zero padding", () => {
    expect(parseDate(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
    expect(parseDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31T23:59");
  });

  test("round-trips through new Date() for start.gg epoch seconds", () => {
    const startAt = 1767261600; // start.gg sends seconds
    const formatted = parseDate(new Date(startAt * 1000));
    expect(new Date(formatted).getTime()).toBe(startAt * 1000);
  });
});

describe("getStreamURL", () => {
  test("builds a Twitch URL from the first stream", () => {
    expect(getStreamURL([{ streamName: "pgk", streamSource: "TWITCH" }], "2026-01-05T09:07")).toEqual({
      streamURL: "https://twitch.tv/pgk",
      streamStartDate: "2026-01-05T09:07",
    });
  });

  test("ignores non-Twitch sources and missing streams", () => {
    expect(getStreamURL([{ streamName: "x", streamSource: "YOUTUBE" }], "d").streamURL).toBeUndefined();
    expect(getStreamURL(undefined, "d")).toEqual({});
    expect(getStreamURL([], "d")).toEqual({});
  });
});

describe("convertToITournament", () => {
  const form = {
    title: "PGK Weekly",
    startDate: "2026-01-05T09:07",
    endDate: "2026-01-05T18:00",
    events: [{ name: "Singles", cap: "64", key: "1" }],
    prices: [{ name: "1st", amount: "50", key: "2" }],
    streamURL: "",
    streamStartDate: "",
  };

  test("converts form dates to epoch ms and strips form-only keys", () => {
    const t = convertToITournament(form);
    expect(t.startDate).toBe(new Date(2026, 0, 5, 9, 7).getTime());
    expect(t.endDate).toBe(new Date(2026, 0, 5, 18, 0).getTime());
    expect(t.events).toEqual([{ name: "Singles", cap: "64" }]);
    expect(t.prices).toEqual([{ name: "1st", amount: 50 }]);
    expect(t.type).toBe("smashgg");
  });

  test("parses streamStartDate only when both stream fields are set", () => {
    const withStream = convertToITournament({
      ...form,
      streamURL: "https://twitch.tv/pgk",
      streamStartDate: "2026-01-05T12:00",
    });
    expect(withStream.streamStartDate).toBe(new Date(2026, 0, 5, 12, 0).getTime());

    // Without a URL the raw form value passes through untouched (spread of `...x`).
    const noUrl = convertToITournament({ ...form, streamStartDate: "2026-01-05T12:00" });
    expect(noUrl.streamStartDate).toBe("2026-01-05T12:00");
  });
});
