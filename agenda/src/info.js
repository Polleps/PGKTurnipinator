import { html } from 'lit-html';

const formater = (date) => new Intl.DateTimeFormat('default', {
  weekday: 'short',
  year: 'numeric',
  month: 'long',
  day: '2-digit',
}).format(date);

const timeFormatter = (date) => new Intl.DateTimeFormat('default', {
  hour: 'numeric', minute: 'numeric',
}).format(date);
export const info = ({city, startDate, cap, participants, location, locationID, isOnline}) => {
  const capText = `${participants ? `${participants}/` : ''}${cap}`;
  const capStyle = participants ? `color: ${colorshift(participants, cap)}` : ''

  return html`
  <ul class="tournament-info-list">
    <li tooltip="Date" tooltip-position="right" class="tournament-date">
      <span class="date-row icon-text"><i class="material-icons">calendar_today</i><span>${formater(startDate)}</span></span>
    </li>
    ${isOnline ? renderTime(startDate) : ''}
    <li tooltip="Location" tooltip-position="right">
      <span class="location-row icon-text">
        <i class="material-icons">
          ${isOnline ? 'language' : 'room'}
        </i>
        <a
          class=${isOnline ? 'online' : ''}
          href=${createURL(isOnline, location, locationID)}
          target="_blank"
          alt="Location on Google Maps"
        >
          ${isOnline ? 'Online' : city}
        </a>
      </span>
    </li>
    <li tooltip="Player Cap" tooltip-position="right">
      <span class="cap-row icon-text" style=${capStyle}><i class="material-icons">person</i>${capText}</span>
    </li>
  </ul>
  `
};

const renderTime = (date) => {
  return html`
      <li class="tournament-time" tooltip="Time" tooltip-position="right">
        <span class="time-row icon-text">
          <i class="material-icons">schedule</i>
          ${timeFormatter(date)}
        </span>
      </li>
    `
}

const colorshift = (p, cap) => {
  const percentage = percentageOf(p, cap);
  const start = { r: 0, g: 0, b:0 };
  const orange = { r: 250, g: 160, b: 0 };
  const red = { r: 250, g: 0, b: 0};
  const treshold = 50;

  if (percentage < treshold) {
    return toCSSColour(start);
  }
  return toCSSColour(fade(ofBetween(p, cap, treshold), orange, red));
}

const fade = (percentage, c1, c2) => {
  const diff = {
    r: c2.r - c1.r,
    g: c2.g - c1.g,
    b: c2.b - c1.b,
  }
  return {
    r: c1.r + of(percentage, diff.r),
    g: c1.g + of(percentage, diff.g),
    b: c1.b + of(percentage, diff.b),
  }
}

const percentageOf = (part, total) => {
  return part / (total / 100);
}

const of = (percentage, num) => {
  return num * (percentage / 100);
}

const ofBetween = (p, n, tr) => {
  const start = of(tr, n);
  const pRelative = p - start;
  const nRelative = n - start;
  return percentageOf(pRelative, nRelative);
}

const toCSSColour = (c) => {
  return `rgb(${c.r},${c.g},${c.b})`;
};

const createURL = (isOnline, location, googleMapsID) => {
  if (isOnline) {
    const url = new URL('https://www.bol.com/nl/p/hori-nintendo-switch-lan-adapter/9200000073064061/?bltgh=r4itZodht932tkiAcVdCfw.1_11.13.ProductTitle');
    return url.toString();
  }
  const url = new URL(`https://www.google.com/maps/search/?api=1&query=${location}&query_place_id=${googleMapsID}`);
  return url.toString();
};
