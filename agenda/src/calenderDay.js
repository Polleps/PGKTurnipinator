import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import noImage from './assets/no-image.jpg';
const link = (slug) => {
  return `https://smash.gg/tournament/${slug}`;
}

const formatUrl = url => {
  // return url ? url.replace('images.smash.gg', 'smashgg.imgix.net') : noImage;
  return url || noImage;
}
export const calendarDay = (day) => {
  const crop = '?auto=compress,format&w=280&h=280&fit=crop'
  const hasTournament = !!day.tournaments.length
  const today = Date.now();
  
  const imageURL = hasTournament ? formatUrl(day.tournaments[0].image) : '#';
  const style = hasTournament ? `background-image: url(${imageURL + crop})` : '';

  const classes = [
    ...(!day.isSelectedMonth ? ["other-month"] : []),
    ...(hasTournament ? ["has-tournament"] : []),
    ...(isToday(new Date(today), new Date(day.date)) ? ["today"] : []),
  ].join(" ");

  const pr = hasTournament ? day.tournaments[0].pr : false

  return html`
    <div class="calendar-item-container" ?prcount=${pr}>
      <div class="calendar-item ${classes}" style="${style}" >
        <div class="date-num">${day.dateNumber}</div>
        <div class="tournament-holder">
          ${repeat(day.tournaments, t => t.title, t => tournamentItem(t))}
        </div>
      </div>
    </div>
  `;
}

const tournamentItem = (tournament) => html`
  <section class="calendar-tournament line-clamp"><a href=${link(tournament.url)}>${tournament.title}</a></section>
`;

const isToday = (a, b) => a.getDate() === b.getDate() &&
                          a.getMonth() === b.getMonth() &&
                          a.getFullYear() === b.getFullYear();
