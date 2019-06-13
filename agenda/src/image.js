import { html } from 'lit-html';

export const pf = (url) => {
  const crop = '?auto=compress,format&w=280&h=280&fit=crop';
  return html`<div class="pf-image-holder"><img src=${url + crop} alt="" loading="lazy"></div>`;
}