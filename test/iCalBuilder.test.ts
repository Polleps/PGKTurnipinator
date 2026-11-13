import { describe, expect, test } from "bun:test";
import { buildICallFile, escapeText, foldLine } from "../src/web/services/ICallBuilder.service";
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

/** Every physical line: no bare LF or CR, each ending in CRLF (the file too). */
const physicalLines = (ics: string) => {
  expect(ics.endsWith("\r\n")).toBe(true);
  const lines = ics.slice(0, -2).split("\r\n");
  for (const line of lines) {
    expect(line).not.toMatch(/[\r\n]/);
    expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  }
  return lines;
};

/** Content lines after unfolding, as [name-with-params, value]. */
const contentLines = (ics: string) =>
  unfold(ics)
    .slice(0, -2)
    .split("\r\n")
    .map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i), l.slice(i + 1)] as const;
    });

const NOW = Date.parse("2026-01-01T08:00:00Z");

describe("buildICallFile", () => {
  test("a VCALENDAR with CRLF line endings everywhere, header and footer included", () => {
    const ics = buildICallFile([base], NOW);
    const lines = physicalLines(ics);
    expect(lines.slice(0, 5)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//nl/pgksmash/agenda//NONSGML v1.0//NL",
      "NAME:PGK Tournament Agenda",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1D",
    ]);
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(ics).toContain("\r\nBEGIN:VEVENT\r\n");
    expect(ics).toContain("\r\nEND:VEVENT\r\n");
  });

  test("an event has exactly the expected properties", () => {
    expect(contentLines(buildICallFile([base], NOW)).slice(5, -1)).toEqual([
      ["BEGIN", "VEVENT"],
      ["UID", "123@pgksmash.nl"],
      ["DTSTAMP", "20260101T080000Z"],
      ["DTSTART", "20260101T100000Z"],
      ["DTEND", "20260101T203005Z"],
      ["SUMMARY", "PGK Weekly #1"],
      ["LOCATION", "Stationsplein 1\\, Utrecht"],
      ["DESCRIPTION", "https://start.gg/tournament/pgk-weekly-1"],
      ["IMAGE;VALUE=URI;DISPLAY=BADGE", "https://images.start.gg/profile.png"],
      ["END", "VEVENT"],
    ]);
  });

  test("no LOCATION for online tournaments and no IMAGE without one", () => {
    const ics = buildICallFile([{ ...base, location: "", image: "", isOnline: true }], NOW);
    const names = contentLines(ics).map(([n]) => n);
    expect(names).not.toContain("LOCATION");
    expect(names.some((n) => n.startsWith("IMAGE"))).toBe(false);
    expect(ics).not.toMatch(/^[A-Z]:/m); // no bogus one-letter property lines
  });

  test("escapes backslash, semicolon, comma and newlines in TEXT values", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    const ics = buildICallFile([{ ...base, title: "Cup; part 1, finals \\o/", location: "Hal 1,\nUtrecht" }], NOW);
    expect(unfold(ics)).toContain("SUMMARY:Cup\\; part 1\\, finals \\\\o/\r\n");
    expect(unfold(ics)).toContain("LOCATION:Hal 1\\,\\nUtrecht\r\n");
  });

  test("folds lines at 75 octets without splitting multi-byte characters", () => {
    const title = "A very long tournament title that definitely exceeds the seventy five octet limit 🎮 ééé ".repeat(3);
    const ics = buildICallFile([{ ...base, title }], NOW);
    physicalLines(ics);
    expect(unfold(ics)).toContain(`SUMMARY:${escapeText(title)}\r\n`);
    const folded = foldLine("X".repeat(74) + "é" + "Y".repeat(80));
    expect(folded.split("\r\n").map((l) => Buffer.byteLength(l))).toEqual([74, 75, 9]);
    expect(folded.replace(/\r\n /g, "")).toBe("X".repeat(74) + "é" + "Y".repeat(80));
  });

  test("uses the start.gg id for the UID, no GEO", () => {
    const ics = buildICallFile([base], NOW);
    expect(ics).toContain("UID:123@pgksmash.nl");
    expect(ics).not.toContain("GEO:");
  });

  test("joins multiple events with CRLF", () => {
    const ics = buildICallFile([base, { ...base, id: "456" }], NOW);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("END:VEVENT\r\nBEGIN:VEVENT");
  });

  test("an empty agenda is still a valid calendar", () => {
    expect(buildICallFile([], NOW)).toBe(
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//nl/pgksmash/agenda//NONSGML v1.0//NL\r\n" +
        "NAME:PGK Tournament Agenda\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1D\r\nEND:VCALENDAR\r\n",
    );
  });
});
