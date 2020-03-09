import { html } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import { calendarDay } from './calenderDay';
import { controlBar } from './controlBar';

export const calendar = ({ onDateChange, onViewChange }) => {
  return (tournaments, month, year) => {
    const tournamentsAtDate = (date) => tournaments.filter((t) => {
      return date >= stripTime(t.startDate) && date <= stripTime(t.endDate || t.startDate);
    });
    const firstDay = (new Date(year, month)).getDay() - 2;
    let startDate = new Date(year, month, firstDay * -1);
    const calendarArray = [];

    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      calendarArray.push({
        key: Math.random(),
        dateNumber: currentDate.getDate(),
        date: currentDate.getTime(),
        isSelectedMonth: currentDate.getMonth() === month,
        tournaments: tournamentsAtDate(currentDate),
      });
    }

    return html`
      ${controlBar(month, year, onDateChange)}
      <div class="calendar">
        <!-- <div class="calendar-header">Ma</div>
        <div class="calendar-header">Di</div>
        <div class="calendar-header">Wo</div>
        <div class="calendar-header">Do</div>
        <div class="calendar-header">Vr</div>
        <div class="calendar-header">Za</div>
        <div class="calendar-header">Zo</div> -->
        ${repeat(dayNames(), d => d, dayHeader)}
        ${repeat(calendarArray, d => d.dateNumber + d.key, d => calendarDay(d))}
      </div>
    `;
  }
}

const dayHeader = (day) => {
  return html`<div class="calendar-header">${day}</div>`;
}
const dayNames = () => {
  const formatter = Intl.DateTimeFormat(undefined, {
    weekday: 'short'
  });
  const oneDay = 86400000;
  let startDate = new Date(2020, 2, 2);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate.getTime() + (oneDay * i))
    const parts = formatter.formatToParts(d);
    console.log(parts);
    const short = parts.find(part => part.type === 'weekday').value;
    days.push(short);
  }
  console.log(days);
  return days;
}


const stripTime = (date) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
