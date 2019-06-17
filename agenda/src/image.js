import { html } from 'lit-html';

export const pf = (url) => {
  const crop = '?auto=compress,format&w=280&h=280&fit=crop';
  return html`<div class="pf-image-holder"><img src=${url.replace('images.smash.gg', 'smashgg.imgix.net') + crop} alt="" loading="lazy"></div>`;
}
