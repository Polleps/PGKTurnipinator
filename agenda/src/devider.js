import { html } from 'lit-html';

export const devider = ({ month }) => {
  const date = new Date(2019, month);
  const formatter = (d) => new Intl.DateTimeFormat('default', {
    month: 'long',
  }).format(d);

  return html`
  <li class="devider">
    <div class="devider-inner">
      <span class="devider-line"></span>
      <span class="devider-month">${formatter(date)}</span>
      <div class="devider-line">
    </div>
  </li>`
}
