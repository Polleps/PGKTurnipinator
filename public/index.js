import { parseQueryString } from './urlParser.js';
import { getAccesstoken, saveToken, setRemember } from './indentifier.js';
import { performAction } from './actionRouter.js';

const accessToken = 'aaaaaaaa' || getAccesstoken();
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
      <section>
        <input type="checkbox" id="remember" checked name="remember"> <label for="remember">Remember Discord User.</label>
      </section>
    `;
    const rememberEL = document.querySelector('#remember');
    setRemember(rememberEL.checked);
    rememberEL.addEventListener('change', (e) => setRemember(e.target.checked));
  } else {
    contentEL.innerHTML = `
    <section>Logged In</section>
    `;
    performAction(query);
  }
})()

