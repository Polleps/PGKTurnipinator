import { html } from 'lit-html';

const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export const controlBar = (
  month,
  year,
  bind = () => { return; },
) => {
  const date = new Date(year, month, 1);
  const addMonth = (x) => new Date(date.getFullYear(), date.getMonth() + x, 1);
  const format = new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'long',
  });

  return html`
    <div class="calendar-control-bar">
      <i @click=${click(bind, addMonth(-1))} class="material-icons bar-item icon-btn">arrow_back</i>
      <span class="bar-item month-name">${format.format(date)}</span>
      <i @click=${click(bind, addMonth(1))} class="material-icons bar-item icon-btn">arrow_forward</i>
    </div>
  `;
}

const click = (binder, val) => ({
  handleEvent(e) {
    binder(val);
  },
  capture: true,
});
