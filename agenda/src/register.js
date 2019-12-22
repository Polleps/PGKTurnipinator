import { html } from 'lit-html';
const smashggBase = 'https://smash.gg/tournament/';
export const registerButton = (url, registrationClosesAt) => html`
<div class="button-holder">
  <a
    href="${smashggBase + url}"
    class="register-button icon-text icon-center"
  >
    <i class="material-icons">launch</i>Info
  </a>
  ${registrationWarning(registrationClosesAt)}
</div>`;

const registrationWarning = (registrationClosesAt) => {
  const warning = formatWarning(registrationClosesAt);
  if (warning === '') {
    return '';
  }
  return html`
    <span class="registration-warning"><i class="material-icons">warning</i>${warning}</span>
  `;
}
const formatWarning = (closeDate) => {
  if (!closeDate) {
    return '';
  }
  const closeTime = (new Date(closeDate)).getTime() * 1000;
  // console.log(closeTime, Date.now());
  if (closeTime < Date.now()) {
    return 'Registration Closed';
  }
  const diff = closeTime - Date.now();
  const days = Math.ceil(diff / (1000*60*60*24));
  const weeks = Math.round(days / 7);
  if (weeks > 2) {
    return '';
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's': ''} left to register!`;
  }
  return `${weeks} week${weeks > 1 ? 's': ''} left to register!`;
}
