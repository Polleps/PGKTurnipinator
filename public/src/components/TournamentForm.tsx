import { For, Show, createSignal, type JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { fetchTournamentDetails, postAction } from "../lib/api";
import {
  MAX_DESCRIPTION_LENGTH,
  applyStartGG,
  cleanStreamInput,
  emptyEvent,
  extractSlug,
  initialFormState,
  postTournamentAction,
  type EventRow as EventRowState,
} from "../lib/formModel";
import { getToken, keepToken } from "../lib/session";
import { validateForm } from "../lib/validation";
import { Checkbox, Input, Textarea } from "./fields";

const click = (handler: () => void) => (e: MouseEvent) => {
  e.preventDefault();
  handler();
};

interface EventRowProps {
  event: EventRowState;
  isLast: boolean;
  disabled: boolean;
  capDisabled: boolean;
  onChange: (patch: Partial<Pick<EventRowState, "name" | "cap">>) => void;
  onAdd: () => void;
  onDelete: () => void;
}

/** One "Events/Games" row: the last row's button adds a row, the others' delete theirs. */
const EventRow = (props: EventRowProps): JSX.Element => (
  <div class="form-row">
    <Input
      name={`eventname${props.event.key}`}
      value={props.event.name}
      class="flex1"
      placeholder="Event Name"
      disabled={props.disabled}
      onValue={(name) => props.onChange({ name })}
    />
    <Input
      type="number"
      name={`eventcap${props.event.key}`}
      value={props.event.cap}
      class="flex1"
      placeholder="Player Cap"
      disabled={props.disabled || props.capDisabled}
      onValue={(cap) => props.onChange({ cap })}
    />
    <a href="#" class="flex-auto add-btn" onClick={click(() => (props.isLast ? props.onAdd() : props.onDelete()))}>
      <i class="material-icons">{props.isLast ? "add" : "delete"}</i>
    </a>
  </div>
);

/** The tournament form: load the details from start.gg ("Fill"), adjust them, post. */
export const TournamentForm = (): JSX.Element => {
  const [state, setState] = createStore(initialFormState());
  const [linkText, setLinkText] = createSignal("");
  const [linkError, setLinkError] = createSignal("");
  const [fetchError, setFetchError] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [postMessage, setPostMessage] = createSignal("");
  const [posted, setPosted] = createSignal("");
  let busy = false;

  const linkSlug = () => {
    const r = extractSlug(linkText());
    return "slug" in r ? r.slug : "";
  };

  const onLink = (text: string) => {
    setLinkText(text);
    const r = extractSlug(text);
    setLinkError("error" in r ? r.error : "");
  };

  const fill = async () => {
    const r = extractSlug(linkText());
    if ("error" in r) {
      setLinkError(r.error);
      return;
    }
    if (busy) {
      return;
    }
    busy = true;
    const result = await fetchTournamentDetails(r.slug, getToken());
    busy = false;
    keepToken();
    if (!result.ok) {
      setFetchError(result.message);
      return;
    }
    setState((s) => applyStartGG(s, r.slug, result.value));
    setLinkText(r.slug);
    setLinkError("");
    setFetchError("");
    setPostMessage("");
    setLoaded(true);
  };

  const submit = async () => {
    const invalid = validateForm(state, { linkSlug: linkSlug() });
    if (invalid) {
      setPostMessage(`Validation Error: ${invalid}`);
      return;
    }
    if (busy) {
      return;
    }
    busy = true;
    const result = await postAction(postTournamentAction(state), getToken());
    busy = false;
    keepToken();
    if (result.ok) {
      setPosted("Tournament Posted");
    } else {
      setPostMessage(result.message);
    }
  };

  const disabled = () => !loaded();

  return (
    <Show
      when={!posted()}
      fallback={
        <div class="fs-message">
          <p>{posted()}</p>
        </div>
      }
    >
      <form class="tournament-form" onSubmit={(e) => e.preventDefault()}>
        <h4>Enter Tournament Details</h4>
        <div class="form-row">
          <span>Start.gg</span>
        </div>
        <div class="form-row">
          <Input
            name="smashgg"
            value={linkText()}
            class="flex1 icon-input ta-link"
            placeholder="Start.gg link"
            onValue={onLink}
          />
          <a href="#" class="btn fill-btn flex-auto" onClick={click(() => void fill())}>
            Fill
          </a>
        </div>
        <Show when={linkError() || fetchError()}>
          <span class="fetch-error">{linkError() || fetchError()}</span>
        </Show>
        <div class="form-row gap" />
        <div class="form-row">
          <span class="icon-label">
            <i class="material-icons">list</i>
            Details
          </span>
        </div>
        <div class="form-row">
          <Input
            name="title"
            value={state.title}
            disabled={disabled()}
            class="flex1"
            placeholder="Tournament Name"
            onValue={(title) => setState("title", title)}
          />
        </div>
        <div class="form-row">
          <Input
            name="location"
            value={state.isOnline ? "Online" : state.location}
            disabled={disabled() || state.isOnline}
            class="flex1 icon-input ta-location"
            placeholder="Location"
            onValue={(location) => setState("location", location)}
          />
        </div>
        <div class="form-row">
          <Input
            type="datetime-local"
            name="start_date"
            value={state.startDate}
            disabled={disabled()}
            class="flex1 icon-input ta-date"
            onValue={(startDate) => setState("startDate", startDate)}
          />
          <span class="flex-auto date-divider"> - </span>
          <Input
            type="datetime-local"
            name="end_date"
            value={state.endDate}
            disabled={disabled()}
            class="flex1 icon-input ta-date"
            onValue={(endDate) => setState("endDate", endDate)}
          />
        </div>
        <div class="form-row">
          <span class="icon-label">
            <i class="material-icons">games</i>Events/Games
          </span>
        </div>
        <Checkbox
          name="nocap"
          checked={state.nocap}
          label="No player caps"
          onChecked={(nocap) => setState("nocap", nocap)}
        />
        <For each={state.events}>
          {(event, index) => (
            <EventRow
              event={event}
              isLast={index() === state.events.length - 1}
              disabled={disabled()}
              capDisabled={state.nocap}
              onChange={(patch) => setState("events", index(), patch)}
              onAdd={() => setState("events", (events) => [...events, emptyEvent()])}
              onDelete={() => setState("events", (events) => events.filter((e) => e.key !== event.key))}
            />
          )}
        </For>
        <div class="form-row">
          <span class="icon-label">
            <i class="material-icons">speaker_notes</i>
            Additional Notes
            <Show when={state.description.length > 0}>
              <span class="counter">
                ({state.description.length}/{MAX_DESCRIPTION_LENGTH})
              </span>
            </Show>
          </span>
        </div>
        <div class="form-row">
          <Textarea
            name="description"
            value={state.description}
            disabled={disabled()}
            class="flex1"
            maxLength={MAX_DESCRIPTION_LENGTH}
            onValue={(description) => setState("description", description)}
          />
          <Show when={state.image}>
            <div class="flex1 logo-holder">
              <img src={state.image} alt="" />
            </div>
          </Show>
        </div>
        <div class="form-row">
          <span class="icon-label">
            <i class="material-icons">live_tv</i>
            Stream
          </span>
        </div>
        <div class="form-row">
          <Input
            name="stream_url"
            value={state.streamURL}
            disabled={disabled()}
            class="flex1"
            placeholder="Twitch URL"
            onValue={(url) => setState("streamURL", cleanStreamInput(url))}
          />
          <Input
            type="datetime-local"
            name="stream_start_date"
            value={state.streamStartDate}
            disabled={disabled()}
            class="flex1 icon-input ta-date"
            onValue={(streamStartDate) => setState("streamStartDate", streamStartDate)}
          />
        </div>
        <div class="form-row">
          <a href="#" class="btn post-btn" onClick={click(() => void submit())}>
            Post
          </a>
        </div>
        <Show when={postMessage()}>
          <div class="form-row">
            <span class="fetch-error flex-auto">{postMessage()}</span>
          </div>
        </Show>
      </form>
    </Show>
  );
};
