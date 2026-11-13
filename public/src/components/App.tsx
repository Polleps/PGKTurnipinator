import type { JSX } from "solid-js";
import { forgetToken, getRemember, getToken, keepToken, setRemember } from "../lib/session";
import { TournamentForm } from "./TournamentForm";

/** Logged out: "Link Discord" starts the OAuth flow (/auth/login → Discord → /auth/callback → /bot). */
const Login = (): JSX.Element => {
  const remember = getRemember();
  setRemember(remember);
  return (
    <>
      <section>
        <p class="no-login-text">To perform this action we need to know who you are.</p>
      </section>
      <section>
        <a href="/auth/login" class="login-btn" id="loginButton">
          Link Discord
        </a>
      </section>
      <section>
        <input
          type="checkbox"
          id="remember"
          name="remember"
          checked={remember}
          onChange={(e) => setRemember(e.currentTarget.checked)}
        />{" "}
        <label for="remember">Remember Discord User.</label>
      </section>
    </>
  );
};

const logout = (e: MouseEvent) => {
  e.preventDefault();
  forgetToken();
  location.reload();
};

export const App = (): JSX.Element => {
  const loggedIn = getToken() !== "";
  if (loggedIn) {
    keepToken();
  }
  return (
    <div class="page-container">
      <header>
        <h2>PGK Dutch Smash Discord</h2>
      </header>
      <div class="content">{loggedIn ? <TournamentForm /> : <Login />}</div>
      <footer>
        {loggedIn && (
          <a href="#" id="logout" class="logout-btn" onClick={logout}>
            <i class="material-icons">exit_to_app</i>Logout
          </a>
        )}
      </footer>
    </div>
  );
};
