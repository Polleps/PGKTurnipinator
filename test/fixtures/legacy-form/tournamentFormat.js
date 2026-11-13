// Frozen copy of public/src/tournamentFormat.js from the lit-html form (before the Phase 5
// Solid port). test/formModel.test.ts compares the new form's request body against it.
// Pure helpers for the tournament form, kept free of DOM/lit-html imports so they can be unit-tested.

const TWITCH_BASE_URL = "https://twitch.tv/";

const buildStreamURL = (name, source) => {
  if (source !== "TWITCH") {
    return undefined;
  }

  return `${TWITCH_BASE_URL}${name}`;
};

export const getStreamURL = (streams, startDate) => {
  if (!streams || streams.length === 0) {
    return {};
  }

  return {
    streamURL: buildStreamURL(streams[0].streamName, streams[0].streamSource),
    streamStartDate: startDate,
  };
};

export const parseDate = (date) => {
  const aZ = (x) => (x < 10 ? `0${x}` : x);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minutes = date.getMinutes();
  return `${year}-${aZ(month)}-${aZ(day)}T${aZ(hour)}:${aZ(minutes)}`;
};

export const convertToITournament = (x) => ({
  ...x,
  startDate: new Date(x.startDate).getTime(),
  endDate: new Date(x.endDate).getTime(),
  events: x.events.map((e) => ({
    name: e.name,
    cap: e.cap,
  })),
  prices: x.prices.map((p) => ({
    name: p.name,
    amount: +p.amount,
  })),
  type: "smashgg",
  ...(!!x.streamURL && !!x.streamStartDate && {
    streamURL: x.streamURL,
    streamStartDate: new Date(x.streamStartDate).getTime(),
  }),
});
