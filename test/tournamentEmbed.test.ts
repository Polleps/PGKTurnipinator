import { describe, expect, test } from "bun:test";
import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { buildEmbed, EmbedPoster } from "../src/web/actions/PostTournament/postEmbed";
import { buildEvent } from "../src/web/actions/PostTournament/scheduleEvent";
import ITournament from "../src/models/ITournament";

const poster: EmbedPoster = {
  username: "fixture-user",
  discriminator: "0",
  avatarURL: "https://cdn.discordapp.com/avatars/1/abc.png",
};

// Midday UTC, so the local-time date formatting gives the same day in any test timezone.
const offline: ITournament = {
  id: "900100",
  url: "fixture-cup",
  title: "Fixture Cup",
  image: "https://images.start.gg/fixture.png",
  events: [
    { name: "Singles", cap: "64" },
    { name: "Doubles", cap: "32" },
    { name: "", cap: "" },
  ],
  description: "Bring a switch",
  location: "Teststraat 1, Utrecht",
  city: "Utrecht",
  locationID: "place123",
  startDate: Date.parse("2026-03-14T12:00:00Z"),
  endDate: Date.parse("2026-03-15T12:00:00Z"),
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

const online: ITournament = {
  ...offline,
  title: "Fixture Online",
  image: "",
  events: [{ name: "Singles", cap: "" }],
  description: "   ",
  location: "",
  startDate: Date.parse("2026-03-14T11:30:00Z"),
  endDate: Date.parse("2026-03-14T13:30:00Z"),
  isOnline: true,
};

describe("tournament embed", () => {
  test("offline tournament: location, date range, events with caps, notes, link", () => {
    expect(buildEmbed(poster, offline).toJSON()).toEqual({
      color: 0xc01f1f,
      thumbnail: { url: "https://images.start.gg/fixture.png" },
      footer: { text: "fixture-user#0", icon_url: "https://cdn.discordapp.com/avatars/1/abc.png" },
      fields: [
        { name: "Fixture Cup", value: "​", inline: undefined },
        {
          name: "🗺 Location",
          value:
            "[Teststraat 1, Utrecht](https://www.google.com/maps/search/?api=1&query=Teststraat%201,%20Utrecht&query_place_id=place123)",
          inline: undefined,
        },
        { name: "📅 Date", value: "March 14th 2026 - March 15th 2026", inline: undefined },
        { name: "🕹 Events", value: "- Singles\n- Doubles", inline: true },
        { name: "Cap", value: "64\n32", inline: true },
        { name: "Additional Info", value: "Bring a switch", inline: undefined },
        { name: "More Info/Register", value: "[Start.gg](https://start.gg/tournament/fixture-cup)", inline: undefined },
      ],
    });
  });

  test("online tournament: globe title, single date, Amsterdam time, no thumbnail or empty notes", () => {
    const json = buildEmbed({ ...poster, avatarURL: null }, online).toJSON();

    expect(json.color).toBe(0x0b92e0);
    expect(json.thumbnail).toBeUndefined();
    expect(json.footer).toEqual({ text: "fixture-user#0", icon_url: undefined });
    expect(json.fields?.map((f) => [f.name, f.value, f.inline])).toEqual([
      ["🌐 Fixture Online", "​", undefined],
      ["📅 Date", "March 14th 2026", undefined],
      ["⏰ Time", "12:30", undefined],
      ["🕹 Events", "- Singles", false],
      ["More Info/Register", "[Start.gg](https://start.gg/tournament/fixture-cup)", undefined],
    ]);
  });

  test("rejects a tournament without named events or with too long notes", () => {
    expect(() => buildEmbed(poster, { ...offline, events: [{ name: "", cap: "" }] })).toThrow("No events found");
    expect(() => buildEmbed(poster, { ...offline, description: "x".repeat(251) })).toThrow("to long");
  });
});

describe("scheduled event options", () => {
  test("external, guild-only event at the stream URL", () => {
    const streamStartDate = Date.parse("2026-03-14T11:00:00Z");
    expect(buildEvent({ ...offline, streamURL: "https://twitch.tv/fixture", streamStartDate })).toEqual({
      name: "Kijk Fixture Cup live op Twitch!",
      scheduledStartTime: streamStartDate,
      scheduledEndTime: offline.endDate,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      description: "Bracket en meer info is te vinden op https://start.gg/tournament/fixture-cup",
      entityMetadata: { location: "https://twitch.tv/fixture" },
    });
  });
});
