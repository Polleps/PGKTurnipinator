import { Request, Response, Router } from "express";
import Config from "../../Config";
import { fetchUserToken, encodeToken } from "../services/authorisation.service";

export interface AuthDeps {
  fetchUserToken: typeof fetchUserToken;
  encodeToken: typeof encodeToken;
}

export class AuthRouter {
  private _router: Router;
  constructor(private deps: AuthDeps = { fetchUserToken, encodeToken }) {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this._router.get("/login", (req: Request, res: Response) => {
      const url = Config.OAUTH2URI;
      res.redirect(url);
    });

    // Express 4 ignores a rejected promise from an async handler, so every failure must be
    // caught here and answered; otherwise the browser waits forever after "Authorize".
    this._router.get("/callback", async (req: Request, res: Response) => {
      const code = req.query.code;
      if (typeof code !== "string" || !code) {
        return res.status(400).send("Error Something went wrong");
      }
      try {
        const userData = await this.deps.fetchUserToken(code);
        const token = await this.deps.encodeToken(userData);
        const expire = 31536000000; // 1yr in ms.
        res.cookie("token", token, { maxAge: expire, path: "/bot/" });
        res.redirect("/bot");
      } catch (e) {
        console.error("OAuth callback failed:", (e as Error).message);
        res.status(502).send("Login with Discord failed. Please try again later.");
      }
    });
  }
}
