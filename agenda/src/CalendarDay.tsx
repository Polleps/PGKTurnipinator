import { For } from "solid-js";
import type { Tournament } from "./api";
import { sameDay } from "./dates";
import noImage from "./assets/no-image.jpg";

const CROP = "?auto=compress,format&w=280&h=280&fit=crop";
const link = (slug: string) => `https://start.gg/tournament/${slug}`;

const isPast = (today: Date, day: Date) => day < new Date(today.getFullYear(), today.getMonth(), today.getDate());

export const CalendarDay = (props: {
  date: Date;
  isSelectedMonth: boolean;
  tournaments: Tournament[];
  now: number;
}) => {
  const hasTournament = () => props.tournaments.length > 0;
  const past = () => isPast(new Date(props.now), props.date);
  const style = () => {
    if (!hasTournament()) return "";
    const image = props.tournaments[0]!.image || noImage;
    const gradient = past() ? "linear-gradient(white, white)," : "";
    const blend = past() ? "background-blend-mode: saturation;" : "";
    return `background-image: ${gradient}url(${image + CROP});${blend}`;
  };
  const classes = () =>
    [
      "calendar-item",
      !props.isSelectedMonth && "other-month",
      hasTournament() && "has-tournament",
      sameDay(new Date(props.now), props.date) && "today",
      past() && "past",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div class="calendar-item-container" attr:prcount={hasTournament() && props.tournaments[0]!.pr ? "" : undefined}>
      <div class={classes()} style={style()}>
        <div class="date-num">{props.date.getDate()}</div>
        <div class="tournament-holder">
          <For each={props.tournaments}>
            {(t) => (
              <section class="calendar-tournament line-clamp">
                <a href={link(t.url)}>{t.title}</a>
              </section>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
