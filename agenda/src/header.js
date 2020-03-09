import { html } from 'lit-html';

export const View = {
  LIST: 1,
  CALENDAR: 2,
}

export const header = ({ onViewChange, showInstallBtn, installPrompt, currentView }) => {
  const titleClasses = showInstallBtn ? 'small-title' : '';

  const renderIcon = () => {
    if (currentView === View.CALENDAR) {
      return html`
        <i
          class="material-icons icon-btn pad"
          tooltip="List View"
          tooltip-position="bottom"
          @click=${click(onViewChange, View.LIST)}
        >
            view_list
        </i>`
    } else {
      return html`
        <i
          class="material-icons icon-btn pad"
          tooltip="Calendar View"
          tooltip-position="bottom"
          @click=${click(onViewChange, View.CALENDAR)}
        >
            view_module
        </i>`;
    }
  }
  return html`
    <div class="header-container">
      <h2 class="${titleClasses}"><a href="/">PGK Tournament Agenda</a></h2>
      ${showInstallBtn ?
        html`<span class="install-btn" @click=${click(installPrompt, null)}>
            <i class="material-icons icon-btn">add_circle</i> Install
          </span>` :
        ''
      }
      ${renderIcon()}
    </div>
  `
}



const click = (binder, val) => ({
  handleEvent(e) {
    binder(val);
  },
  capture: true,
});
