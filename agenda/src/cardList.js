import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import { card } from './card.js';
import { devider } from './devider.js';

export const cardList = ({ onDateChange, onViewChange}) => {
  const isNum = x => (+x === +x) && x !== null;

  return (tournaments, month, year) => {
    const today = new Date();
    let lastMonth = undefined;
    console.log(tournaments);
    const sortedTournaments = tournaments.sort((a, b) => a.startDate - b.startDate)
                                          .filter(t => t.endDate >= today);
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
  }
};
