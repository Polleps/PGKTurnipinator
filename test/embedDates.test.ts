import { describe, expect, test } from "bun:test";
import { formatDate, formatTime } from "../src/web/actions/PostTournament/postEmbed";

// Pinned from the moment-based formatting, so swapping the implementation can't change the embed text.
describe("embed time (Europe/Amsterdam, HH:mm)", () => {
  test.each([
    ["2026-03-14T11:30:00Z", "12:30"], // CET, UTC+1
    ["2026-07-01T18:05:00Z", "20:05"], // CEST, UTC+2
    ["2026-03-29T00:59:00Z", "01:59"], // last minute before spring-forward
    ["2026-03-29T01:00:00Z", "03:00"], // first minute after it
    ["2026-10-25T00:30:00Z", "02:30"], // first 02:30 (CEST)
    ["2026-10-25T01:30:00Z", "02:30"], // second 02:30 (CET)
    ["2026-12-31T23:15:00Z", "00:15"], // next day in Amsterdam
  ])("%s -> %s", (iso, expected) => {
    expect(formatTime(Date.parse(iso))).toBe(expected);
    expect(formatTime(new Date(iso))).toBe(expected);
  });
});

// Midday UTC, so the calendar day is the same in Amsterdam and in any test machine timezone.
describe("embed date (MMMM Do YYYY)", () => {
  test.each([
    ["2026-01-01T12:00:00Z", "January 1st 2026"],
    ["2026-02-02T12:00:00Z", "February 2nd 2026"],
    ["2026-03-03T12:00:00Z", "March 3rd 2026"],
    ["2026-04-04T12:00:00Z", "April 4th 2026"],
    ["2026-05-11T12:00:00Z", "May 11th 2026"],
    ["2026-06-12T12:00:00Z", "June 12th 2026"],
    ["2026-07-13T12:00:00Z", "July 13th 2026"],
    ["2026-08-21T12:00:00Z", "August 21st 2026"],
    ["2026-09-22T12:00:00Z", "September 22nd 2026"],
    ["2026-10-23T12:00:00Z", "October 23rd 2026"],
    ["2026-10-25T12:00:00Z", "October 25th 2026"], // DST ends that night
    ["2026-12-31T12:00:00Z", "December 31st 2026"],
    ["2027-03-28T12:00:00Z", "March 28th 2027"], // DST starts that night
  ])("%s -> %s", (iso, expected) => {
    expect(formatDate(new Date(iso))).toBe(expected);
  });
});

describe("embed date uses Amsterdam's calendar day", () => {
  test("just after midnight in Amsterdam is already the next day", () => {
    // 00:30 CEST on July 1st, still June 30th in UTC.
    expect(formatDate(new Date("2026-06-30T22:30:00Z"))).toBe("July 1st 2026");
  });
});
