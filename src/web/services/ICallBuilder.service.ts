import ITournament from "../../models/ITournament";

/**
 * The agenda as an iCalendar file (RFC 5545, plus NAME/REFRESH-INTERVAL/IMAGE from RFC 7986).
 * Every line ends in CRLF, is folded at 75 octets, and TEXT values are escaped.
 */

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;

/** RFC 5545 3.3.11: backslash, semicolon and comma are escaped; newlines become \n. */
export const escapeText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n|\r/g, "\\n");

/**
 * RFC 5545 3.1: lines longer than 75 octets continue on the next line after CRLF and a space.
 * Splits between characters, never inside a multi-byte UTF-8 sequence.
 */
export const foldLine = (line: string): string => {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current);
      current = " ";
      octets = 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(CRLF);
};

const formatUTC = (ms: number): string =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const buildEvent = (tournament: ITournament, now: number): string[] => [
  "BEGIN:VEVENT",
  `UID:${tournament.id}@pgksmash.nl`,
  `DTSTAMP:${formatUTC(now)}`,
  `DTSTART:${formatUTC(tournament.startDate)}`,
  `DTEND:${formatUTC(tournament.endDate)}`,
  `SUMMARY:${escapeText(tournament.title)}`,
  ...(tournament.location.trim() ? [`LOCATION:${escapeText(tournament.location)}`] : []),
  `DESCRIPTION:${escapeText(`https://start.gg/tournament/${tournament.url}`)}`,
  ...(tournament.image.trim() ? [`IMAGE;VALUE=URI;DISPLAY=BADGE:${tournament.image}`] : []),
  "END:VEVENT",
];

export const buildICallFile = (tournaments: ITournament[], now: number = Date.now()): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nl/pgksmash/agenda//NONSGML v1.0//NL",
    "NAME:PGK Tournament Agenda",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1D",
    ...tournaments.flatMap((t) => buildEvent(t, now)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
};
