import { html } from 'lit-html';
import noImage from './assets/no-image.jpg';
export const pf = (url) => {
  const convertedURL = url ? replaceURL(url) : noImage;
  return html`<div class="pf-image-holder"><img src=${convertedURL} alt="" loading="lazy"></div>`;
};

const replaceURL = (url) => {
  const crop = '?auto=compress,format&w=280&h=280&fit=crop';
  // return url.replace('images.start.gg', 'smashgg.imgix.net') + crop;
  return url + crop;
};
