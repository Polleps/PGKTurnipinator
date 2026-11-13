import { createSignal, Match, onCleanup, Switch } from "solid-js";
import { render } from "solid-js/web";
import { TournamentPager, WindowCache, type PagerState } from "./api";
import { Calendar } from "./Calendar";
import { CardList } from "./CardList";
import { Header, View } from "./Header";
import "./agenda.css";

// Same URL and scope as the old webpack worker. A new version activates right away and
// reloads open pages itself (see service-worker.js).
if ("serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${base}service-worker.js`, { scope: base }).catch((err: unknown) => {
      console.error("Service worker registration failed.", err);
    });
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const storage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode or blocked storage: the view just isn't remembered.
    }
  },
};

const storedView = Number(storage.get("agenda_view"));
const [view, setView] = createSignal<View>(storedView === View.CALENDAR ? View.CALENDAR : View.LIST);
const [date, setDate] = createSignal(new Date());
const [installEvent, setInstallEvent] = createSignal<BeforeInstallPromptEvent | null>(null);

// "Now" for live/past/today markers; ticks every minute so an open agenda doesn't go stale.
const [now, setNow] = createSignal(Date.now());

const [listState, setListState] = createSignal<PagerState>({ items: [], done: false, loading: false, error: null });
const pager = new TournamentPager(undefined, setListState);
const months = new WindowCache();

const changeView = (v: View) => {
  setView(v);
  storage.set("agenda_view", String(v));
};

const installPrompt = () => {
  const e = installEvent();
  if (!e) return;
  setInstallEvent(null);
  void e.prompt();
  e.userChoice.then(
    (choice) =>
      console.log(choice.outcome === "accepted" ? "User accepted the A2HS prompt" : "User dismissed the A2HS prompt"),
    () => undefined,
  );
};

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setInstallEvent(e as BeforeInstallPromptEvent);
});

render(
  () => (
    <Header
      currentView={view()}
      onViewChange={changeView}
      showInstallBtn={installEvent() !== null}
      installPrompt={installPrompt}
    />
  ),
  document.querySelector("header")!,
);

render(() => {
  const timer = setInterval(() => setNow(Date.now()), 60_000);
  onCleanup(() => clearInterval(timer));
  return (
    <Switch>
      <Match when={view() === View.LIST}>
        <CardList state={listState()} onLoadMore={() => void pager.loadMore()} now={now()} />
      </Match>
      <Match when={view() === View.CALENDAR}>
        <Calendar
          year={date().getFullYear()}
          month={date().getMonth()}
          now={now()}
          cache={months}
          onDateChange={setDate}
        />
      </Match>
    </Switch>
  );
}, document.querySelector(".page")!);

void pager.loadMore();
