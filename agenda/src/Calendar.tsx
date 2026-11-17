import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import { ApiError, type Tournament, type WindowCache } from "./api";
import { CalendarDay } from "./CalendarDay";
import { ControlBar } from "./ControlBar";
import { monthGrid, onDay, weekdayNames } from "./dates";

const dayNames = weekdayNames();

/**
 * Month view. Each month asks the API for the window of its visible weeks (every page), and the
 * neighbouring months are prefetched so prev/next is instant.
 */
export const Calendar = (props: {
  year: number;
  month: number;
  now: number;
  cache: WindowCache;
  onDateChange: (date: Date) => void;
}) => {
  const grid = createMemo(() => monthGrid(props.year, props.month));
  // The previous month's data stays until the new month arrives: cells only show tournaments on
  // their own day, so the shared weeks stay right and the other cells are empty meanwhile.
  const [tournaments, setTournaments] = createSignal<Tournament[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(
    on(grid, (g) => {
      let current = true;
      onCleanup(() => (current = false));
      setError(null);
      props.cache.get(g.from, g.to).then(
        (items) => {
          if (current) setTournaments(items);
        },
        (e: unknown) => {
          if (!current) return;
          setTournaments([]);
          setError(
            e instanceof ApiError && e.offline
              ? "You are offline, and this month has not been loaded before."
              : "Could not load the tournaments for this month.",
          );
        },
      );
      for (const delta of [-1, 1]) {
        const next = monthGrid(props.year, props.month + delta);
        props.cache.get(next.from, next.to).catch(() => undefined);
      }
    }),
  );

  const selectedMonth = () => new Date(props.year, props.month, 1).getMonth();

  return (
    <>
      <ControlBar year={props.year} month={props.month} onDateChange={props.onDateChange} />
      <Show when={error()}>{(message) => <div class="agenda-notice">{message()}</div>}</Show>
      <div class="calendar" style={{ "--weeks": String(grid().days.length / 7) }}>
        <For each={dayNames}>{(d) => <div class="calendar-header">{d}</div>}</For>
        <For each={grid().days}>
          {(day) => (
            <CalendarDay
              date={day}
              isSelectedMonth={day.getMonth() === selectedMonth()}
              tournaments={onDay(tournaments(), day)}
              now={props.now}
            />
          )}
        </For>
      </div>
    </>
  );
};
