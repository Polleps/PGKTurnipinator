import { describe, expect, test } from "bun:test";
import { buildICallFile } from "../src/web/services/ICallBuilder.service";
import type ITournament from "../src/models/ITournament";

const base: ITournament = {
  id: "123",
  url: "pgk-weekly-1",
  title: "PGK Weekly #1",
  image: "https://images.start.gg/profile.png",
  events: [{ name: "Ultimate Singles", cap: "64" }],
  location: "Stationsplein 1, Utrecht",
  city: "Utrecht",
  locationID: "x",
  // Firestore stores these as epoch milliseconds (see public/src/tournamentFormat.js).
  startDate: 1767261600000 as unknown as Date, // 2026-01-01T10:00:00Z
  endDate: "2026-01-01T20:30:05Z" as unknown as Date,
  type: "smashgg",
  isOnline: false,
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

  test("formats dates as UTC basic format from numbers and strings", () => {
    const ics = buildICallFile([base]);
    expect(ics).toContain("DTSTART:20260101T100000Z");
    expect(ics).toContain("DTEND:20260101T203005Z");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  test("uses smashggID for the UID when present, else id", () => {
    expect(buildICallFile([base])).toContain("UID:123@pgksmash.nl");
    expect(buildICallFile([{ ...base, smashggID: "999" }])).toContain("UID:999@pgksmash.nl");
  });

  test("includes GEO only with coordinates and links the start.gg page", () => {
    expect(buildICallFile([base])).not.toContain("GEO:");
    const ics = buildICallFile([{ ...base, lat: 52.09, lng: 5.11 }]);
    expect(ics).toContain("GEO:52.09;5.11");
    expect(ics).toContain("DESCRIPTION:https://start.gg/tournament/pgk-weekly-1");
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
