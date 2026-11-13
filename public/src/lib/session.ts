/**
 * The login session: the server's `/auth/callback` sets a `token` cookie (a JWT, path /bot/,
 * one year). Without "Remember Discord User" the form turns it into a session cookie, so it's
 * gone when the browser closes. The form sends the token in each request body.
 */
const COOKIE = "token";
const COOKIE_PATH = "/bot/";
const REMEMBER_KEY = "remember";

/** The value of cookie `name` in a `document.cookie` string, or "". */
export const readCookie = (cookies: string, name: string): string => {
  for (const part of cookies.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return "";
};

export const getToken = (): string => readCookie(document.cookie, COOKIE);

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

/**
 * Re-saves the current token as a session cookie unless the user asked to be remembered.
 * Reads the cookie again, so a token the server just refreshed (Set-Cookie) is kept.
 */
export const keepToken = (): void => {
  const token = getToken();
  if (token && !getRemember()) {
    document.cookie = `${COOKIE}=${token};path=${COOKIE_PATH}`;
  }
};

export const forgetToken = (): void => {
  document.cookie = `${COOKIE}= ; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=${COOKIE_PATH}`;
};
