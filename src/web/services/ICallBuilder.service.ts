import ITournament from "../../models/ITournament";
import { Buffer } from "buffer";
export const buildICallFile = (tournaments: ITournament[]) => {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//nl/pgksmash/agenda//NONSGML v1.0//NL
NAME:PGK Tournament Agenda
REFRESH-INTERVAL;VALUE=DURATION:PT1D
${tournaments.map(buildEvent).join("\r\n")}
END:VCALENDAR
`;
};

const buildEvent = (tournament: ITournament): string => {
  const eventMap = [
    ["BEGIN", "VEVENT"],
    ["SUMMARY", tournament.title],
    ["UID", `${tournament.smashggID || tournament.id}@pgksmash.nl`],
    ["DTSTART", formatUTC(new Date(tournament.startDate))],
    ["DTEND", formatUTC(new Date(tournament.endDate))],
    ["DTSTAMP", formatUTC(new Date())],
    ["LOCATION", tournament.location.replace(/,/g, "\\,")],
    ...(tournament.lat ? [["GEO", `${tournament.lat};${tournament.lng}`]] : []),
    ["DESCRIPTION", "https://smash.gg/tournament/" + tournament.url],
    ["IMAGE", `IMAGE;VALUE=URI;DISPLAY=BADGE;FMTTYPE=image/png:${tournament.image}`],
    ["END", "VEVENT"],
  ];

  return eventMap.map((prop) => {
    const text = `${prop[0]}:${prop[1]}`;
    return slicePart(Buffer.from(text, "utf8")).toString("utf8");
  }).join("\r\n");

};

const slicePart = (b: Buffer): Buffer => {
  if (b.byteLength < 76) {
    return b;
  }
  return Buffer.concat([
    b.slice(0, 75),
    Buffer.from("\r\n"),
    Buffer.from(String.fromCharCode(0x20)),
    slicePart(b.slice(75)),
  ]);
};

const formatUTC = (d: Date): string => {
  const pad0 = (num) => `${num}`.length === 1 ? `0${num}` : `${num}`;
  const UTCDATE = `${d.getUTCFullYear()}${pad0(d.getUTCMonth() + 1)}${pad0(d.getUTCDate())}`;
  const UTCTIME = `${pad0(d.getUTCHours())}${pad0(d.getUTCMinutes())}${pad0(d.getUTCSeconds())}`;
  return `${UTCDATE}T${UTCTIME}Z`;
};
