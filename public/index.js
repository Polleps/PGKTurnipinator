import { parseQueryString } from './urlParser.js';
import { getToken, saveToken, setRemember, forgetToken } from './indentifier.js';
import { performAction } from './actionRouter.js';

const accessToken = getToken();
const query = parseQueryString(window.location.search) || {};
console.log(query);

function renderNoToken() {
  const contentEL = findElement('.content');
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
  const rememberEL = findElement('#remember');
  setRemember(rememberEL.checked);
  rememberEL.addEventListener('change', (e) => setRemember(e.target.checked));

  const loginEl = findElement('#loginButton');
  loginEl.addEventListener('click', (e) => {
    if (query.action) sessionStorage.setItem('previousURLState', JSON.stringify(query));
  });
}

function doAction(action) {
  performAction(action, accessToken)
    .then((res) => {
      console.log(res);
      sessionStorage.removeItem('previousURLState');
      renderSuccessMessage(res.message);
    })
    .catch((res) => {
      renderFailMessage(res.message);
    });
}

const renderNoAction = () => {
  const contentEL = findElement('.content');
  contentEL.innerHTML = `<section>Logged In</section>`;
}

const renderSuccessMessage = (message) => {
  const contentEL = findElement('.content');
  contentEL.innerHTML = `<section class="action-message">${message}</section>`;
}

const renderFailMessage = (message) => {
  const contentEL = findElement('.content');
  contentEL.innerHTML = `<section class="action-message fail-message">${message}</section>`;
}

const renderLogout = () => {
  const footerEL = findElement('footer');
  footerEL.innerHTML = `<a href="#" id="logout">Logout</a>`;
  const logoutEL = findElement('#logout');
  logoutEL.addEventListener('click', (e) => {
    forgetToken();
  });
}

const findElement = (str) => document.querySelector(str);

(function () {
  if (!accessToken) return renderNoToken();

  saveToken(accessToken);
  renderLogout();
  let action = query.action ? query : JSON.parse(sessionStorage.getItem('previousURLState'));
  if (action) return doAction(action);
  renderNoAction();

})()
