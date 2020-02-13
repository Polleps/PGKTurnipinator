import { parseQueryString } from './urlParser.js';
import { getToken, saveToken, setRemember, forgetToken } from './indentifier.js';
import { performAction } from './actionRouter.js';
import { findElement } from './helpers.js';
import './style.css';

const accessToken = getToken();
const query = parseQueryString(window.location.search) || {};

function renderNoToken() {
  const contentEL = findElement('.content');
  const remember = localStorage.getItem('remember') === 'true';
  contentEL.innerHTML = `
    <section>
      <p class="no-login-text">To perform this action we need to know who you are.</p>
    </section>
    <section>
      <a href="/auth/login" class="login-btn" id="loginButton">Link Discord</a>
      </section>
      <section>
        <input type="checkbox" id="remember" ${remember ? 'checked': ''} name="remember"> <label for="remember">Remember Discord User.</label>
      </section>
    `;
  const rememberEL = findElement('#remember');
  setRemember(rememberEL.checked);
  rememberEL.addEventListener('change', (e) => setRemember(e.target.checked));

  const loginEl = findElement('#loginButton');
  loginEl.addEventListener('click', (e) => {
    if (query.action) sessionStorage.setItem('previousURLState', JSON.stringify(query));
  });
}

function doAction(action) {
  try {
    performAction(action, accessToken);
  } catch (err) {
    renderFailMessage(err);
  }
}

const renderNoAction = () => {
  const contentEL = findElement('.content');
  contentEL.innerHTML = `<section>Logged In</section>`;
}

const renderFailMessage = (message) => {
  const contentEL = findElement('.content');
  contentEL.innerHTML = `<section class="action-message fail-message">${message}</section>`;
}

const renderLogout = () => {
  const footerEL = findElement('footer');

  footerEL.innerHTML = `<a href="#" id="logout" class="logout-btn"><i class="material-icons">exit_to_app</i>Logout</a>`;
  const logoutEL = findElement('#logout');

  logoutEL.addEventListener('click', (e) => {
    forgetToken();
    document.location.reload(true);
  });
}

(function () {
  if (!accessToken) return renderNoToken();

  saveToken(accessToken);
  renderLogout();
  let action = query.action ? query : JSON.parse(sessionStorage.getItem('previousURLState'));
  if (action) return doAction(action);
  renderNoAction();

})()
