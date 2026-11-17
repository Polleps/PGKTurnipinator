import { createEffect, createMemo, For, on, onCleanup, onMount, Show } from "solid-js";
import type { PagerState, Tournament } from "./api";
import { Card, Devider } from "./Card";

type Row = { kind: "month"; key: string; month: number } | { kind: "card"; key: string; tournament: Tournament };

/** Upcoming and ongoing tournaments, a month divider whenever the start month changes. */
export const CardList = (props: { state: PagerState; onLoadMore: () => void; now: number }) => {
  const rows = createMemo<Row[]>((previous = []) => {
    // Reuse the previous rows' objects so <For> keeps their DOM when a page is appended.
    const old = new Map(previous.map((r) => [r.key, r]));
    const rows: Row[] = [];
    let last = "";
    for (const t of props.state.items) {
      const start = new Date(t.startDate);
      const monthKey = `${start.getFullYear()}-${start.getMonth()}`;
      if (monthKey !== last) {
        last = monthKey;
        const key = `month-${monthKey}`;
        rows.push(old.get(key) ?? { kind: "month", key, month: start.getMonth() });
      }
      const key = `t-${t.id}`;
      const prev = old.get(key);
      rows.push(prev?.kind === "card" && prev.tournament === t ? prev : { kind: "card", key, tournament: t });
    }
    return rows;
  });

  // Infinite scroll: load the next page when the "Load more" button comes near the viewport.
  // The button stays as the fallback (and the retry after an error, when this stops loading).
  let button: HTMLButtonElement | undefined;
  onMount(() => {
    if (!button || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !props.state.error) props.onLoadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(button);
    onCleanup(() => observer.disconnect());
    // The observer only reports changes; if the button is still in view after a page has been
    // added (a short page), observing it again reports it once more and loads the next one.
    createEffect(
      on(
        () => props.state.items.length,
        () => {
          observer.unobserve(button!);
          observer.observe(button!);
        },
        { defer: true },
      ),
    );
  });

  return (
    <div class="card-holder">
      <ul class="card-list">
        <For each={rows()}>
          {(row) =>
            row.kind === "month" ? <Devider month={row.month} /> : <Card tournament={row.tournament} now={props.now} />
          }
        </For>
        <li class="load-more" hidden={props.state.done && !props.state.error}>
          <Show when={props.state.error}>
            {(error) => (
              <div class="agenda-notice">
                {error().offline
                  ? props.state.items.length
                    ? "You are offline; more tournaments can be loaded when you are back online."
                    : "You are offline, and the agenda has not been loaded before."
                  : "Could not load the tournaments."}
              </div>
            )}
          </Show>
          <button
            ref={(el) => (button = el)}
            type="button"
            class="register-button load-more-button"
            disabled={props.state.loading}
            onClick={() => props.onLoadMore()}
          >
            {props.state.loading ? "Loading…" : props.state.error ? "Try again" : "Load more"}
          </button>
        </li>
        <Show when={props.state.done && !props.state.error && props.state.items.length === 0}>
          <li class="agenda-notice">No upcoming tournaments.</li>
        </Show>
      </ul>
    </div>
  );
};
