import { For } from "solid-js";
import { liveStreamUrl, type Tournament } from "./api";
import { Info } from "./Info";
import { RegisterButton } from "./Register";
import noImage from "./assets/no-image.jpg";

const CROP = "?auto=compress,format&w=280&h=280&fit=crop";

export const Card = (props: { tournament: Tournament; now: number }) => {
  const t = () => props.tournament;
  return (
    <li class="card-list-item" attr:prcount={t().pr ? "" : undefined} attr:online={t().isOnline ? "" : undefined}>
      <div class="card">
        <div class="pf-image-holder">
          <img src={t().image ? t().image + CROP : noImage} alt="" loading="lazy" />
        </div>
        <div class="tournament-title">{t().title}</div>
        <Info tournament={t()} />
        <ul class="event-list">
          <For each={t().events ?? []}>{(e) => <li>{e.name}</li>}</For>
        </ul>
        <RegisterButton
          url={t().url}
          registrationClosesAt={t().registrationClosesAt}
          startDate={t().startDate}
          isOnline={t().isOnline}
          liveStreamUrl={liveStreamUrl(t(), props.now)}
          now={props.now}
        />
      </div>
    </li>
  );
};

const monthFormat = new Intl.DateTimeFormat("default", { month: "long" });

export const Devider = (props: { month: number }) => (
  <li class="devider">
    <div class="devider-inner">
      <span class="devider-line" />
      <span class="devider-month">{monthFormat.format(new Date(2019, props.month))}</span>
      <div class="devider-line" />
    </div>
  </li>
);
