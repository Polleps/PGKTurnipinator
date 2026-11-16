import { Request, Response, Router } from "express";
import {
  verifyActionRequest,
  refreshUserToken,
  encodeToken,
  encodeSession,
  IDecodedToken,
} from "../services/authorisation.service";
import UserInfoCache from "../UserInfoCache";
import ActionService from "../services/action.service";
import { IAction } from "../actions/IAction";
import { IUserInfo } from "../discord.agent";
import { fetchTournamentDetails } from "../services/smashgg.service";
import { userCanFetchTournament } from "../services/access.service";
import { actionErrorResponse } from "../actions/ActionError";
import { asyncHandler, clearSessionCookie, csrfGuard, readCookie, SESSION_COOKIE, setSessionCookie } from "../session";

export interface ActionDeps {
  verifyActionRequest: typeof verifyActionRequest;
  refreshUserToken: typeof refreshUserToken;
  encodeToken: typeof encodeToken;
  encodeSession: typeof encodeSession;
  getUserInfo: (accessToken: string) => Promise<IUserInfo>;
  runAction: (userInfo: IUserInfo, action: IAction) => Promise<string>;
  fetchTournamentDetails: typeof fetchTournamentDetails;
  userCanFetchTournament: (userInfo: IUserInfo) => Promise<boolean> | undefined;
}

const defaultDeps = (): ActionDeps => {
  const actionService = new ActionService();
  return {
    verifyActionRequest,
    refreshUserToken,
    encodeToken,
    encodeSession,
    getUserInfo: (accessToken) => UserInfoCache.get(accessToken),
    runAction: (userInfo, action) => actionService.run(userInfo, action),
    fetchTournamentDetails,
    userCanFetchTournament,
  };
};

export const NOT_LOGGED_IN = "You are not logged in (or your login expired). Please log in again.";

/**
 * The tournament form's API, mounted at `/bot/api` so the session cookie (path `/bot/`)
 * reaches it. Every route needs a valid session cookie; POSTs also pass the CSRF guard.
 */
export class ActionRouter {
  private _router: Router;

  constructor(private deps: ActionDeps = defaultDeps()) {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this._router.use(csrfGuard);

    // ::POST:: [URL]/logout (no valid session needed to clear it)
    this._router.post("/logout", (_req: Request, res: Response) => {
      clearSessionCookie(res);
      res.status(204).end();
    });

    // ::AUTH MIDDLEWARE
    this._router.use(
      asyncHandler(async (req: Request, res: Response, next) => {
        const cookie = readCookie(req, SESSION_COOKIE);
        if (!cookie) {
          return res.status(401).json({ error: true, message: NOT_LOGGED_IN });
        }
        let session: IDecodedToken;
        try {
          session = await this.deps.verifyActionRequest(cookie);
        } catch {
          clearSessionCookie(res);
          return res.status(401).json({ error: true, message: NOT_LOGGED_IN });
        }

        // Cookies from before the remember flag was stored were readable by page JS;
        // re-issue them as httpOnly, defaulting to a session cookie.
        const remember = session.remember ?? false;
        if (session.expires <= Date.now()) {
          try {
            const newToken = await this.deps.encodeToken(
              await this.deps.refreshUserToken(session.refresh_token),
              remember,
            );
            session = await this.deps.verifyActionRequest(newToken);
            setSessionCookie(res, newToken, remember);
          } catch (e) {
            console.error("Refreshing the Discord token failed:", (e as Error).message);
            clearSessionCookie(res);
            return res.status(401).json({ error: true, message: NOT_LOGGED_IN });
          }
        } else if (session.remember === undefined) {
          setSessionCookie(res, await this.deps.encodeSession({ ...session, remember }), remember);
        }

        const userInfo = await this.deps.getUserInfo(session.access_token).catch((e: unknown) => {
          console.error("Fetching the Discord user failed:", (e as Error).message);
          return undefined;
        });
        // Discord answers a revoked token with an error body instead of a user.
        if (!userInfo?.id) {
          return res.status(401).json({ error: true, message: NOT_LOGGED_IN });
        }
        res.locals.userInfo = userInfo;
        next();
      }),
    );

    // ::GET:: [URL]/me — who is logged in (401 when nobody).
    this._router.get("/me", (_req: Request, res: Response) => {
      const { id, username, global_name } = res.locals.userInfo as IUserInfo;
      res.status(200).json({ id, username, global_name: global_name ?? null });
    });

    // ::POST:: [URL]/actions/run
    this._router.post(
      "/actions/run",
      asyncHandler(async (req: Request, res: Response) => {
        const userInfo = res.locals.userInfo as IUserInfo;
        const action = req.body.action as IAction;
        try {
          const message = await this.deps.runAction(userInfo, action);
          res.status(200).json({ message });
        } catch (e) {
          console.error(e);
          const { status, body } = actionErrorResponse(e);
          res.status(status).json(body);
        }
      }),
    );

    this._router.use("/actions/tournamentdetails", (_req: Request, res: Response, next) => {
      // FIXME: this check is not awaited, so the promise is always truthy and the role
      // gate never blocks anyone. Kept as-is in Phase 0 (no behavior change); fix by
      // awaiting it in a dedicated change.
      const roleCheck = this.deps.userCanFetchTournament(res.locals.userInfo as IUserInfo);
      if (roleCheck) {
        next();
      } else {
        res.status(400).send({ error: true, message: "Invalid User. Please logout and try again." });
      }
    });

    this._router.post(
      "/actions/tournamentdetails/:slug",
      asyncHandler(async (req: Request, res: Response) => {
        try {
          const details = await this.deps.fetchTournamentDetails(req.params.slug);
          res.status(200).json({ message: "success", data: details });
        } catch (e) {
          console.error(e);
          res.status(400).json({ message: "invalid tournament", error: true });
        }
      }),
    );
  }
}
