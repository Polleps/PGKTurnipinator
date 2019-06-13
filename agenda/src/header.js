import { html } from 'lit-html';

export const header = ({ onViewChange, showInstallBtn, installPrompt }) => {
  const titleClasses = showInstallBtn ? 'small-title' : '';
  return html`
    <div class="header-container">
      <h2 class="${titleClasses}">Tournament Agenda</h2>
      ${showInstallBtn ?
        html`<span class="install-btn" @click=${click(installPrompt, null)}>
            <i class="material-icons icon-btn">add_circle</i> Install
          </span>` :
        ''
      }
      <i class="material-icons icon-btn" tooltip="List View" tooltip-position="bottom" @click=${click(onViewChange, 'list')}>view_list</i>
      <i class="material-icons icon-btn" tooltip="Calendar View" tooltip-position="bottom" @click=${click(onViewChange, 'calendar')}>view_module</i>
    </div>
  `
}

const click = (binder, val) => ({
  handleEvent(e) {
    binder(val);
  },
  capture: true,
});
