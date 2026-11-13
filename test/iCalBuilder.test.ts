import { describe, expect, test } from "bun:test";
import { buildICallFile } from "../src/web/services/ICallBuilder.service";
import type ITournament from "../src/models/ITournament";

const base: ITournament = {
  id: "123",
  url: "pgk-weekly-1",
  title: "PGK Weekly #1",
  image: "https://images.start.gg/profile.png",
  description: "",
  events: [{ name: "Ultimate Singles", cap: "64" }],
  location: "Stationsplein 1, Utrecht",
  city: "Utrecht",
  locationID: "x",
  startDate: 1767261600000, // 2026-01-01T10:00:00Z
  endDate: Date.parse("2026-01-01T20:30:05Z"),
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: null,
  guildEventID: null,
};

const unfold = (ics: string) => ics.replace(/\r\n /g, "");

describe("buildICallFile", () => {
  test("wraps events in a VCALENDAR", () => {
    const ics = buildICallFile([base]);
    expect(ics.startsWith("BEGIN:VCALENDAR\nVERSION:2.0\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("\r\nEND:VEVENT");
  });

  test("formats epoch-ms dates as UTC basic format", () => {
    const ics = buildICallFile([base]);
    expect(ics).toContain("DTSTART:20260101T100000Z");
    expect(ics).toContain("DTEND:20260101T203005Z");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  test("uses the start.gg id for the UID and links the start.gg page", () => {
    const ics = buildICallFile([base]);
    expect(ics).toContain("UID:123@pgksmash.nl");
    expect(ics).toContain("DESCRIPTION:https://start.gg/tournament/pgk-weekly-1");
    expect(ics).not.toContain("GEO:");
  });

  test("folds lines longer than 75 octets per RFC 5545", () => {
    const title = "A very long tournament title that definitely exceeds the seventy five octet limit";
    const ics = buildICallFile([{ ...base, title }]);
    const event = ics.split("BEGIN:VEVENT\r\n")[1];
    for (const line of event.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(76);
    }
    expect(unfold(ics)).toContain(`SUMMARY:${title}`);
  });

  test("joins multiple events with CRLF", () => {
    const ics = buildICallFile([base, { ...base, id: "456" }]);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("END:VEVENT\r\nBEGIN:VEVENT");
  });

  // Known bugs, preserved in Phase 0 (no behavior change). Fix them with these as the spec:
  test.todo("emits a LOCATION line (today the spread yields bogus `L:O` / `<first char>:<second char>` lines)");
  test.todo("emits IMAGE without the duplicated `IMAGE:IMAGE;` prefix");
  test.todo("uses CRLF for the VCALENDAR header/footer lines, not just inside events");
});
