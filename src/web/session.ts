import { timingSafeEqual } from "crypto";
import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from "express";
import Config from "../Config";

/**
 * The tournament form's login session lives in an httpOnly cookie that page JS can't read.
 *
 * Name and path are the ones the server always used, so a cookie from before this change
 * (readable by JS) is still sent to the form API and gets re-issued as httpOnly.
 */
export const SESSION_COOKIE = "token";
export const SESSION_PATH = "/bot/";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The OAuth `state` of a login in progress, only sent back to the callback. */
export const STATE_COOKIE = "oauth_state";
export const STATE_PATH = "/auth/callback";
export const STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Secure cookies need https. The OAuth redirect URI is the public address the browser comes
 * back to, so it says whether the site is served over https (production) or plain http
 * (local development), independent of NODE_ENV or a reverse proxy in front.
 */
export const isSecureOrigin = (redirectURI: string | undefined): boolean => !!redirectURI?.startsWith("https://");

const baseOptions = (path: string): CookieOptions => ({
  httpOnly: true,
  secure: isSecureOrigin(Config.RedirectURI),
  sameSite: "lax",
  path,
});

/** "Remember me" → a one-year cookie; otherwise a session cookie, gone when the browser closes. */
export const setSessionCookie = (res: Response, token: string, remember: boolean): void => {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(SESSION_PATH), ...(remember ? { maxAge: ONE_YEAR_MS } : {}) });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, baseOptions(SESSION_PATH));
};

export const setStateCookie = (res: Response, value: string): void => {
  res.cookie(STATE_COOKIE, value, { ...baseOptions(STATE_PATH), maxAge: STATE_MAX_AGE_MS });
};

export const clearStateCookie = (res: Response): void => {
  res.clearCookie(STATE_COOKIE, baseOptions(STATE_PATH));
};

/** The value of cookie `name` on the request, or undefined. */
export const readCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie;
  return header ? (new Bun.CookieMap(header).get(name) ?? undefined) : undefined;
};

/** Constant-time string comparison (the length is not secret). */
export const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * CSRF protection for the cookie-authenticated API. Besides SameSite=Lax on the cookie,
 * every state-changing request must
 *  - be a JSON request: a cross-site page can only send JSON with a CORS preflight, which
 *    this server never allows (HTML forms can't send `application/json` at all), and
 *  - not be marked cross-site by the browser (`Sec-Fetch-Site`, which page JS can't set).
 */
export const csrfGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const fetchSite = req.headers["sec-fetch-site"];
  if (contentType !== "application/json" || (fetchSite !== undefined && fetchSite !== "same-origin")) {
    return res.status(403).json({ error: true, message: "Request blocked: it did not come from this site." });
  }
  next();
};

/**
 * Express 4 ignores a rejected promise from an async handler (the request would hang), so
 * wrap every async handler: a failure becomes a 500 instead.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch((e: unknown) => {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: "Something went wrong on the server." });
      }
    });
  };
