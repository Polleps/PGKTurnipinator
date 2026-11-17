import { describe, expect, mock, test } from "bun:test";
import { Guild, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import { buildEmbed, EmbedPoster } from "../src/web/actions/PostTournament/postEmbed";
import { buildEvent, fetchEventImage, scheduleEvent } from "../src/web/actions/PostTournament/scheduleEvent";
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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const PNG_URI = `data:image/png;base64,${PNG.toString("base64")}`;

const imageFetch = (body: BodyInit | null = PNG, init: ResponseInit = { headers: { "content-type": "image/png" } }) =>
  mock(
    async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, init),
  ) as unknown as typeof fetch & ReturnType<typeof mock>;

const failingFetch = () =>
  mock(async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch & ReturnType<typeof mock>;

/** A guild whose scheduled events record creates/edits; `rejectImage` makes Discord refuse a cover. */
const eventGuild = (opts: { rejectImage?: boolean; missingEvent?: boolean } = {}) => {
  const check = (o: { image?: unknown }) => {
    if (opts.rejectImage && o.image) {
      throw new Error("Invalid Form Body: image");
    }
  };
  const create = mock(async (o: { image?: unknown }) => {
    check(o);
    return { id: "new-event" };
  });
  const edit = mock(async (o: { image?: unknown }) => {
    check(o);
  });
  const fetchEvent = mock(async (_id: string) => {
    if (opts.missingEvent) {
      throw new Error("Unknown Guild Scheduled Event");
    }
    return { edit };
  });
  const guild = { scheduledEvents: { create, fetch: fetchEvent } } as unknown as Guild;
  return { guild, create, edit };
};

const streamed: ITournament = {
  ...offline,
  streamURL: "https://twitch.tv/fixture",
  streamStartDate: Date.parse("2026-03-14T11:00:00Z"),
};

describe("event cover image", () => {
  test("fetches the thumbnail as a data URI with its own content type", async () => {
    const fetchImpl = imageFetch();
    expect(await fetchEventImage(" https://images.start.gg/fixture.png ", fetchImpl)).toBe(PNG_URI);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://images.start.gg/fixture.png");
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  test("no thumbnail, bad URL, HTTP error, wrong type, empty or failed fetch all give null", async () => {
    const error = console.error;
    console.error = () => {};
    try {
      expect(await fetchEventImage("", imageFetch())).toBeNull();
      expect(await fetchEventImage("not a url", imageFetch())).toBeNull();
      expect(await fetchEventImage("https://x.test/a.png", imageFetch(PNG, { status: 404 }))).toBeNull();
      expect(
        await fetchEventImage(
          "https://x.test/a.svg",
          imageFetch(PNG, { headers: { "content-type": "image/svg+xml" } }),
        ),
      ).toBeNull();
      expect(await fetchEventImage("https://x.test/a.png", imageFetch(new Uint8Array(0)))).toBeNull();
      expect(
        await fetchEventImage(
          "https://x.test/a.png",
          imageFetch(PNG, { headers: { "content-type": "image/png", "content-length": String(64 * 1024 * 1024) } }),
        ),
      ).toBeNull();
      expect(await fetchEventImage("https://x.test/a.png", failingFetch())).toBeNull();
    } finally {
      console.error = error;
    }
  });

  test("a new event gets the thumbnail as its cover", async () => {
    const { guild, create } = eventGuild();
    expect(await scheduleEvent(guild, streamed, imageFetch())).toBe("new-event");
    expect(create.mock.calls[0][0]).toEqual({ ...buildEvent(streamed), image: PNG_URI });
  });

  test("an existing event is edited with the cover", async () => {
    const { guild, create, edit } = eventGuild();
    expect(await scheduleEvent(guild, { ...streamed, guildEventID: "old-event" }, imageFetch())).toBe("old-event");
    expect(create).not.toHaveBeenCalled();
    expect(edit.mock.calls[0][0]).toEqual({ ...buildEvent(streamed), image: PNG_URI });
  });

  test("without a thumbnail, or when it cannot be fetched, the event is still created without a cover", async () => {
    const error = console.error;
    console.error = () => {};
    try {
      const noImage = eventGuild();
      expect(await scheduleEvent(noImage.guild, { ...streamed, image: "" }, failingFetch())).toBe("new-event");
      expect(noImage.create.mock.calls[0][0]).toEqual({ ...buildEvent(streamed), image: undefined });

      const broken = eventGuild();
      expect(await scheduleEvent(broken.guild, streamed, failingFetch())).toBe("new-event");
      expect(broken.create.mock.calls[0][0].image).toBeUndefined();
    } finally {
      console.error = error;
    }
  });

  test("when Discord rejects the cover, create and edit retry without it", async () => {
    const error = console.error;
    console.error = () => {};
    try {
      const created = eventGuild({ rejectImage: true });
      expect(await scheduleEvent(created.guild, streamed, imageFetch())).toBe("new-event");
      expect(created.create.mock.calls.map((c) => c[0].image)).toEqual([PNG_URI, undefined]);

      const edited = eventGuild({ rejectImage: true });
      expect(await scheduleEvent(edited.guild, { ...streamed, guildEventID: "old-event" }, imageFetch())).toBe(
        "old-event",
      );
      expect(edited.edit.mock.calls.map((c) => c[0].image)).toEqual([PNG_URI, undefined]);
    } finally {
      console.error = error;
    }
  });

  test("a vanished event is recreated with the cover", async () => {
    const error = console.error;
    console.error = () => {};
    try {
      const { guild, create } = eventGuild({ missingEvent: true });
      expect(await scheduleEvent(guild, { ...streamed, guildEventID: "gone" }, imageFetch())).toBe("new-event");
      expect(create.mock.calls[0][0].image).toBe(PNG_URI);
    } finally {
      console.error = error;
    }
  });
});
