import { Show } from "solid-js";
import { registrationWarning } from "./dates";

const START_GG = "https://start.gg/tournament/";

/** "Info" link to start.gg, the registration deadline warning, and a stream link while live. */
export const RegisterButton = (props: {
  url: string;
  registrationClosesAt?: number;
  startDate: number;
  isOnline: boolean;
  liveStreamUrl?: string;
  now: number;
}) => {
  const warning = () => registrationWarning(props.registrationClosesAt, props.startDate, props.now);
  return (
    <div class="button-holder">
      <a href={START_GG + props.url} class={`register-button icon-text icon-center ${props.isOnline ? "online" : ""}`}>
        <i class="material-icons">launch</i>Info
      </a>
      <Show when={props.liveStreamUrl}>
        {(href) => (
          <a
            class="live-link icon-text icon-center"
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            title="Live now: watch the stream"
          >
            <i class="material-icons">live_tv</i>Watch live
          </a>
        )}
      </Show>
      <Show when={warning()}>
        {(text) => (
          <span class="registration-warning">
            <i class="material-icons">warning</i>
            {text()}
          </span>
        )}
      </Show>
    </div>
  );
};
