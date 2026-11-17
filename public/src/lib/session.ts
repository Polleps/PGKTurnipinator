/**
 * The login session is an httpOnly cookie set by the server (`/auth/callback`), so this page
 * never sees the token. It learns whether someone is logged in from `GET /bot/api/me`.
 *
 * Only the "Remember Discord User" checkbox is kept here (a UI preference, no secret): it is
 * sent along with the login, and the server makes the cookie persistent or not.
 */
const REMEMBER_KEY = "remember";

const storage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

export const getRemember = (): boolean => storage()?.getItem(REMEMBER_KEY) === "true";

export const setRemember = (remember: boolean): void => {
  storage()?.setItem(REMEMBER_KEY, `${remember}`);
};

/** Where "Link Discord" goes. */
export const loginURL = (remember: boolean): string => (remember ? "/auth/login?remember=1" : "/auth/login");
