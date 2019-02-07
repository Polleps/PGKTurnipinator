import { parseQueryString } from './urlParser.js';
import { getToken, saveToken, setRemember } from './indentifier.js';
import { performAction } from './actionRouter.js';

const accessToken = getToken();
const query = parseQueryString(window.location.search) || {};
console.log(query);
(function () {
  if (!accessToken) return renderNoToken();

  saveToken(accessToken);
  let action = query.action ? query : JSON.parse(sessionStorage.getItem('previousURLState'));
  if (action) return doAction(action);
  renderNoAction();

})()

function renderNoToken() {
  const contentEL = document.querySelector('.content');
  contentEL.innerHTML = `
    <section>
      <p class="no-login-text">To perfom this action we need to know who you are.</p>
    </section>
    <section>
      <a href="/auth/login" class="login-btn" id="loginButton">Link Discord</a>
      </section>
      <section>
        <input type="checkbox" id="remember" checked name="remember"> <label for="remember">Remember Discord User.</label>
      </section>
    `;
  const rememberEL = document.querySelector('#remember');
  setRemember(rememberEL.checked);
  rememberEL.addEventListener('change', (e) => setRemember(e.target.checked));

  const loginEl = document.querySelector('#loginButton');
  loginEl.addEventListener('click', (e) => {
    if (query.action) sessionStorage.setItem('previousURLState', JSON.stringify(query));
  });
}

function doAction(action) {
  // Todo: Display a massage when action was performed succesfully.
  performAction(action, accessToken)
    .then(() => sessionStorage.removeItem('previousURLState'));
}

function renderNoAction() {
  const contentEL = document.querySelector('.content');
  contentEL.innerHTML = `<section>Logged In</section>`;
}
