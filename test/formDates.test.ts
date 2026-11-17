import { afterEach, describe, expect, test } from "bun:test";
import { fromLocalInput, fromStartGGTime, toLocalInput } from "../public/src/lib/dates";
import { parseAmsterdamLocalDateTime } from "../src/db/normalizeTournament";

const originalTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTZ;
});

describe("form dates are Europe/Amsterdam wall-clock time", () => {
  test("winter (CET, UTC+1) and summer (CEST, UTC+2)", () => {
    expect(fromLocalInput("2026-01-05T09:07")).toBe(Date.parse("2026-01-05T08:07:00Z"));
    expect(fromLocalInput("2026-07-05T09:07")).toBe(Date.parse("2026-07-05T07:07:00Z"));
    expect(toLocalInput(Date.parse("2026-01-05T08:07:00Z"))).toBe("2026-01-05T09:07");
    expect(toLocalInput(Date.parse("2026-07-05T07:07:00Z"))).toBe("2026-07-05T09:07");
  });

  test("do not depend on the browser's time zone", () => {
    for (const tz of ["America/New_York", "Asia/Tokyo", "UTC", "Europe/Amsterdam"]) {
      process.env.TZ = tz;
      expect(fromLocalInput("2026-03-14T12:00")).toBe(Date.parse("2026-03-14T11:00:00Z"));
      expect(toLocalInput(Date.parse("2026-03-14T11:00:00Z"))).toBe("2026-03-14T12:00");
    }
  });

  test("start.gg epoch seconds become a datetime-local value and back", () => {
    const startAt = 1767261600; // 2026-01-01T10:00:00Z
    expect(fromStartGGTime(startAt)).toBe("2026-01-01T11:00");
    expect(fromLocalInput(fromStartGGTime(startAt))).toBe(startAt * 1000);
  });

  test("seconds are dropped, padding is kept", () => {
    expect(toLocalInput(Date.parse("2026-12-31T22:59:59Z"))).toBe("2026-12-31T23:59");
    expect(toLocalInput(Date.parse("2027-01-01T00:05:00Z"))).toBe("2027-01-01T01:05");
  });

  test("DST start: the skipped hour (02:00-02:59 on 29 March 2026) doesn't exist", () => {
    expect(fromLocalInput("2026-03-29T01:59")).toBe(Date.parse("2026-03-29T00:59:00Z"));
    expect(fromLocalInput("2026-03-29T02:00")).toBeUndefined();
    expect(fromLocalInput("2026-03-29T02:30")).toBeUndefined();
    expect(fromLocalInput("2026-03-29T03:00")).toBe(Date.parse("2026-03-29T01:00:00Z"));
    expect(toLocalInput(Date.parse("2026-03-29T01:00:00Z"))).toBe("2026-03-29T03:00");
  });

  test("DST end: the repeated hour (02:00-02:59 on 25 October 2026) resolves to the second one (CET)", () => {
    expect(fromLocalInput("2026-10-25T01:59")).toBe(Date.parse("2026-10-24T23:59:00Z"));
    expect(fromLocalInput("2026-10-25T02:30")).toBe(Date.parse("2026-10-25T01:30:00Z"));
    expect(fromLocalInput("2026-10-25T03:00")).toBe(Date.parse("2026-10-25T02:00:00Z"));
    // Both moments show as 02:30.
    expect(toLocalInput(Date.parse("2026-10-25T00:30:00Z"))).toBe("2026-10-25T02:30");
    expect(toLocalInput(Date.parse("2026-10-25T01:30:00Z"))).toBe("2026-10-25T02:30");
  });

  test("empty and malformed values are undefined", () => {
    for (const v of ["", "2026-01-05", "2026-02-30T10:00", "2026-01-05T24:00", "05-01-2026 10:00", "nonsense"]) {
      expect(fromLocalInput(v)).toBeUndefined();
    }
  });

  test("parses exactly like the server (parseAmsterdamLocalDateTime)", () => {
    const values: string[] = [];
    // Every 30 minutes around both 2026 DST switches, plus a sample across the year.
    for (const day of ["2026-03-28", "2026-03-29", "2026-10-24", "2026-10-25"]) {
      for (let m = 0; m < 24 * 60; m += 30) {
        values.push(`${day}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
      }
    }
    for (let month = 1; month <= 12; month++) {
      values.push(`2027-${String(month).padStart(2, "0")}-15T18:45`);
    }
    for (const v of values) {
      expect([v, fromLocalInput(v)]).toEqual([v, parseAmsterdamLocalDateTime(v)]);
    }
  });
});
