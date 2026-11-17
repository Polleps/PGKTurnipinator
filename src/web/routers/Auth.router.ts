import { randomBytes } from "crypto";
import { Request, Response, Router } from "express";
import Config from "../../Config";
import { fetchUserToken, encodeToken } from "../services/authorisation.service";
import {
  asyncHandler,
  clearStateCookie,
  readCookie,
  safeEqual,
  setSessionCookie,
  setStateCookie,
  STATE_COOKIE,
} from "../session";

export interface AuthDeps {
  fetchUserToken: typeof fetchUserToken;
  encodeToken: typeof encodeToken;
  /** The Discord authorize URL (OAUTH2_URI); the per-login `state` is added to it. */
  authorizeURL: string;
}

/** Where the form lives; the session cookie is scoped to it. */
const FORM_URL = "/bot/";

const errorPage = (res: Response, status: number, message: string) =>
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8"><title>Login failed</title>` +
        `<p>${message}</p><p><a href="${FORM_URL}">Back to the form</a></p>`,
    );

/**
 * Discord OAuth for the tournament form:
 * `/auth/login` → Discord → `/auth/callback` → session cookie → `/bot/`.
 *
 * A random `state` ties the callback to the browser that started the login (an attacker
 * can't log a victim into the attacker's account by sending them a callback link).
 */
export class AuthRouter {
  private _router: Router;
  constructor(private deps: AuthDeps = { fetchUserToken, encodeToken, authorizeURL: Config.OAUTH2URI }) {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    // `?remember=1` comes from the form's "Remember Discord User" checkbox.
    this._router.get("/login", (req: Request, res: Response) => {
      let url: URL;
      try {
        url = new URL(this.deps.authorizeURL);
      } catch {
        console.error("OAUTH2_URI is not a valid URL.");
        return errorPage(res, 500, "Login with Discord is not configured.");
      }
      const state = randomBytes(32).toString("base64url");
      const remember = req.query.remember === "1";
      setStateCookie(res, `${state}.${remember ? 1 : 0}`);
      url.searchParams.set("state", state);
      res.redirect(url.toString());
    });

    this._router.get(
      "/callback",
      asyncHandler(async (req: Request, res: Response) => {
        const stored = readCookie(req, STATE_COOKIE) ?? "";
        clearStateCookie(res);
        // The user pressed "Cancel" on Discord's consent screen.
        if (typeof req.query.error === "string") {
          return res.redirect(FORM_URL);
        }
        const [expectedState = "", rememberFlag] = stored.split(".");
        const state = req.query.state;
        if (!expectedState || typeof state !== "string" || !safeEqual(state, expectedState)) {
          return errorPage(
            res,
            400,
            "This login link has expired or was started in another browser. Please log in again from the form.",
          );
        }
        const code = req.query.code;
        if (typeof code !== "string" || !code) {
          return errorPage(res, 400, "Discord did not send a login code. Please try again.");
        }
        try {
          const userData = await this.deps.fetchUserToken(code);
          const remember = rememberFlag === "1";
          const token = await this.deps.encodeToken(userData, remember);
          setSessionCookie(res, token, remember);
          res.redirect(FORM_URL);
        } catch (e) {
          console.error("OAuth callback failed:", (e as Error).message);
          errorPage(res, 502, "Login with Discord failed. Please try again later.");
        }
      }),
    );
  }
}
