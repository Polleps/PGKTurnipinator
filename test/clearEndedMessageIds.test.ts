import { describe, expect, test } from "bun:test";
import { applyClear, ClearError, planClear } from "../scripts/lib/clearEndedMessageIds";
import { openDatabase } from "../src/db/database";
import type { NormalizedTournament } from "../src/db/normalizeTournament";
import { TournamentRepository } from "../src/db/TournamentRepository";

const HOUR = 3600000;
const NOW = Date.parse("2026-11-18T10:00:00Z");
const KEEP = "borderline-smash-71";

const tournament = (id: string, overrides: Partial<NormalizedTournament> = {}): NormalizedTournament => ({
  id,
  url: `slug-${id}`,
  title: `Tournament ${id}`,
  image: "",
  description: "",
  location: "Some Street 1",
  city: "Utrecht",
  locationID: "",
  startDate: NOW - 20 * HOUR,
  endDate: NOW - 10 * HOUR,
  type: "smashgg",
  isOnline: false,
  nocap: false,
  pr: false,
  events: [{ name: "Singles", cap: "" }],
  prices: [],
  streamURL: null,
  streamStartDate: null,
  messageID: `msg-${id}`,
  guildEventID: null,
  ...overrides,
});

const setup = (...rows: NormalizedTournament[]) => {
  const db = openDatabase({ path: ":memory:" });
  const repo = new TournamentRepository(db);
  rows.forEach((t) => repo.upsert(t));
  return { sqlite: db.$client, repo };
};

const messageIds = (repo: TournamentRepository) => Object.fromEntries(repo.all().map((t) => [t.id, t.messageID]));

describe("clear ended message ids", () => {
  const rows = () => [
    tournament("1"),
    tournament("2", { endDate: NOW }), // ends exactly now: ended
    tournament("3", { url: KEEP }),
    tournament("4", { startDate: NOW - HOUR, endDate: NOW + HOUR }), // still running
    tournament("5", { messageID: null }),
  ];

  test("dry run plans the ended ones except the kept slug and writes nothing", () => {
    const { sqlite, repo } = setup(...rows());
    const plan = planClear(sqlite, NOW, KEEP);
    expect(plan.keep.id).toBe("3");
    expect(plan.clear.map((r) => r.id).sort()).toEqual(["1", "2"]);
    expect(messageIds(repo)).toEqual({ "1": "msg-1", "2": "msg-2", "3": "msg-3", "4": "msg-4", "5": null });
  });

  test("apply clears only those message ids and keeps every row", () => {
    const { sqlite, repo } = setup(...rows());
    expect(applyClear(sqlite, NOW, KEEP).changed).toBe(2);
    expect(messageIds(repo)).toEqual({ "1": null, "2": null, "3": "msg-3", "4": "msg-4", "5": null });
    expect(applyClear(sqlite, NOW, KEEP).changed).toBe(0);
  });

  test("refuses when the kept slug is missing, not ended, or ambiguous", () => {
    const cases: NormalizedTournament[][] = [
      [tournament("1")],
      [tournament("1"), tournament("3", { url: KEEP, messageID: null })],
      [tournament("1"), tournament("3", { url: KEEP, startDate: NOW - HOUR, endDate: NOW + HOUR })],
      [tournament("1"), tournament("3", { url: KEEP }), tournament("6", { url: KEEP })],
    ];
    for (const c of cases) {
      const { sqlite, repo } = setup(...c);
      expect(() => planClear(sqlite, NOW, KEEP)).toThrow(ClearError);
      expect(() => applyClear(sqlite, NOW, KEEP)).toThrow(ClearError);
      expect(repo.getById("1")?.messageID).toBe("msg-1");
    }
  });
});
