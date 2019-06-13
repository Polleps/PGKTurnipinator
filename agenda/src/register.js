import { html } from 'lit-html';
const smashggBase = 'https://smash.gg/tournament/';
export const registerButton = (url) => html`
<div class="button-holder">
  <a href="${smashggBase + url}" class="register-button icon-text icon-center"><i class="material-icons">launch</i>Info</a>
</div>`;
