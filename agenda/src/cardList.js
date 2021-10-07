import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import { card } from './card.js';
import { devider } from './devider.js';

const isNum = x => (+x === +x) && x !== null;

export const cardList = ({ onDateChange, onViewChange}) => (tournaments, month, year) => {
  const today = new Date();
  let lastMonth = undefined;

  // Sort tournaments by date and only keep upcomming.
  const sortedTournaments = tournaments.filter(t => t.endDate >= today)
                                      .sort((a, b) => {
                                        if (!a.startDate) return -1;
                                        return a.startDate - b.startDate;
                                      });
  // Insert deviders between months.
  const devidedTournaments = sortedTournaments.flatMap((t) => {
    const startDate = new Date(t.startDate);
    if (lastMonth !== startDate.getMonth()) {
      lastMonth = startDate.getMonth();
      return [
        { month: lastMonth },
        t
      ];
    }
    return t;
  });

  return html`
    <div class="card-holder">
      <ul class="card-list">
        ${repeat(devidedTournaments, (t) => t.title, (t) => isNum(t.month) ? devider(t) : card(t))}
      </ul>
    </div>
  `;
};

