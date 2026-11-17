import { Show } from "solid-js";

export const View = {
  LIST: 1,
  CALENDAR: 2,
} as const;
export type View = (typeof View)[keyof typeof View];

export const Header = (props: {
  currentView: View;
  onViewChange: (view: View) => void;
  showInstallBtn: boolean;
  installPrompt: () => void;
}) => (
  <div class="header-container">
    <h2 class={props.showInstallBtn ? "small-title" : ""}>
      <a href="/agenda/">PGK Tournament Agenda</a>
    </h2>
    <Show when={props.showInstallBtn}>
      <span class="install-btn" onClick={() => props.installPrompt()}>
        <i class="material-icons icon-btn">add_circle</i> Install
      </span>
    </Show>
    <Show
      when={props.currentView === View.CALENDAR}
      fallback={
        <i
          class="material-icons icon-btn pad"
          attr:tooltip="Calendar View"
          attr:tooltip-position="bottom"
          onClick={() => props.onViewChange(View.CALENDAR)}
        >
          view_module
        </i>
      }
    >
      <i
        class="material-icons icon-btn pad"
        attr:tooltip="List View"
        attr:tooltip-position="bottom"
        onClick={() => props.onViewChange(View.LIST)}
      >
        view_list
      </i>
    </Show>
  </div>
);
