import { parseQueryString } from './urlParser.js';
import { createCookieGetter } from './cookieParser.js';

const getCookie = createCookieGetter(document.cookie);
const accessToken = getCookie('accesstoken');
const query = parseQueryString(window.location.search);
console.log(query);
(function () {
  const contentEL = document.querySelector('.content');
  if (!accessToken) {
    contentEL.innerHTML = `
    <section>
      <p class="no-login-text">To perfom this action we need to know who you are.</p>
    </section>
    <section>
      <a href="/auth/login" class="login-btn">Link Discord</a>
    </section>
    `;
  } else {
    contentEL.innerHTML = `
    <section>Logged In</section>
    `;
  }
})()

