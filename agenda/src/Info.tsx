import { Show } from "solid-js";
import { tournamentCap, type Tournament } from "./api";

const dateFormat = new Intl.DateTimeFormat("default", {
  weekday: "short",
  year: "numeric",
  month: "long",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("default", { hour: "numeric", minute: "numeric" });

/** Date, time (online only), location and player cap. */
export const Info = (props: { tournament: Tournament }) => {
  const t = () => props.tournament;
  const cap = () => tournamentCap(t());
  const capText = () => `${t().participants ? `${t().participants}/` : ""}${t().nocap ? "-" : cap()}`;
  const capStyle = () => (t().participants ? `color: ${colorshift(t().participants!, Number(cap()))}` : "");

  return (
    <ul class="tournament-info-list">
      <li attr:tooltip="Date" attr:tooltip-position="right" class="tournament-date">
        <span class="date-row icon-text">
          <i class="material-icons">calendar_today</i>
          <span>{dateFormat.format(t().startDate)}</span>
        </span>
      </li>
      <Show when={t().isOnline}>
        <li class="tournament-time" attr:tooltip="Time" attr:tooltip-position="right">
          <span class="time-row icon-text">
            <i class="material-icons">schedule</i>
            {timeFormat.format(t().startDate)}
          </span>
        </li>
      </Show>
      <li attr:tooltip="Location" attr:tooltip-position="right">
        <span class="location-row icon-text">
          <i class="material-icons">{t().isOnline ? "language" : "room"}</i>
          <a class={t().isOnline ? "online" : ""} href={locationUrl(t())} target="_blank">
            {t().isOnline ? "Online" : t().city}
          </a>
        </span>
      </li>
      <li attr:tooltip="Player Cap" attr:tooltip-position="right">
        <span class="cap-row icon-text" style={capStyle()}>
          <i class="material-icons">person</i>
          {capText()}
        </span>
      </li>
    </ul>
  );
};

interface Colour {
  r: number;
  g: number;
  b: number;
}

/** Black below half full, then orange to red as the tournament fills up. */
const colorshift = (participants: number, cap: number): string => {
  const percentage = percentageOf(participants, cap);
  const threshold = 50;
  if (percentage < threshold) return toCSSColour({ r: 0, g: 0, b: 0 });
  return toCSSColour(fade(ofBetween(participants, cap, threshold), { r: 250, g: 160, b: 0 }, { r: 250, g: 0, b: 0 }));
};

const fade = (percentage: number, c1: Colour, c2: Colour): Colour => ({
  r: c1.r + of(percentage, c2.r - c1.r),
  g: c1.g + of(percentage, c2.g - c1.g),
  b: c1.b + of(percentage, c2.b - c1.b),
});

const percentageOf = (part: number, total: number) => part / (total / 100);
const of = (percentage: number, num: number) => num * (percentage / 100);
const ofBetween = (p: number, n: number, threshold: number) => {
  const start = of(threshold, n);
  return percentageOf(p - start, n - start);
};
const toCSSColour = (c: Colour) => `rgb(${c.r},${c.g},${c.b})`;

const locationUrl = (t: Tournament): string => {
  if (t.isOnline) {
    return "https://www.bol.com/nl/p/hori-nintendo-switch-lan-adapter/9200000073064061/?bltgh=r4itZodht932tkiAcVdCfw.1_11.13.ProductTitle";
  }
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query: t.location, query_place_id: t.locationID }).toString();
  return url.toString();
};
