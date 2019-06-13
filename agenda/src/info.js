import { html } from 'lit-html';

const formater = (date) => new Intl.DateTimeFormat('default', {
  weekday: 'short',
  year: 'numeric',
  month: 'long',
  day: '2-digit'
}).format(date);
export const info = ({city, startDate, cap, participants}) => html`
<ul class="tournament-info-list">
  <li tooltip="Date" tooltip-position="right">
    <span class="date-row icon-text"><i class="material-icons">calendar_today</i>${formater(startDate)}</span>
  </li>
  <li tooltip="Location" tooltip-position="right">
    <span class="location-row icon-text"><i class="material-icons">room</i>${city}</span>
  </li>
  <li tooltip="Player Cap" tooltip-position="right">
    <span class="cap-row icon-text"><i class="material-icons">person</i>${participants ? `${participants}/` : ''}${cap}</span>
  </li>
</ul>
`;
