import { createResource, createSignal, Match, Switch, type JSX } from "solid-js";
import { fetchMe, logout as logoutRequest } from "../lib/api";
import { getRemember, loginURL, setRemember } from "../lib/session";
import { TournamentForm } from "./TournamentForm";

/** Logged out: "Link Discord" starts the OAuth flow (/auth/login → Discord → /auth/callback → /bot). */
const Login = (): JSX.Element => {
  const [remember, setRememberSignal] = createSignal(getRemember());
  const toggle = (checked: boolean) => {
    setRemember(checked);
    setRememberSignal(checked);
  };
  return (
    <>
      <section>
        <p class="no-login-text">To perform this action we need to know who you are.</p>
      </section>
      <section>
        <a href={loginURL(remember())} class="login-btn" id="loginButton">
          Link Discord
        </a>
      </section>
      <section>
        <input
          type="checkbox"
          id="remember"
          name="remember"
          checked={remember()}
          onChange={(e) => toggle(e.currentTarget.checked)}
        />{" "}
        <label for="remember">Remember Discord User.</label>
      </section>
    </>
  );
};

const logout = async (e: MouseEvent) => {
  e.preventDefault();
  await logoutRequest();
  location.reload();
};

export const App = (): JSX.Element => {
  // `null` = not logged in; an error result = the server could not be asked.
  const [me] = createResource(fetchMe);
  const loggedIn = () => {
    const result = me();
    return result?.ok === true && result.value !== null;
  };
  return (
    <div class="page-container">
      <header>
        <h2>PGK Dutch Smash Discord</h2>
      </header>
      <div class="content">
        <Switch>
          <Match when={me.loading}>
            <section>
              <p class="no-login-text">Loading…</p>
            </section>
          </Match>
          <Match when={loggedIn()}>
            <TournamentForm />
          </Match>
          <Match when={me()?.ok === false}>
            <section>
              <p class="no-login-text">{(me() as { message: string }).message}</p>
            </section>
          </Match>
          <Match when={true}>
            <Login />
          </Match>
        </Switch>
      </div>
      <footer>
        {loggedIn() && (
          <a href="#" id="logout" class="logout-btn" onClick={(e) => void logout(e)}>
            <i class="material-icons">exit_to_app</i>Logout
          </a>
        )}
      </footer>
    </div>
  );
};
