import { Request, Response, Router } from "express";
import Config from "../../Config";
import { fetchUserToken, encodeToken } from "../services/authorisation.service";

export class AuthRouter {
  private _router: Router;
  constructor() {
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

    this._router.get("/callback", async (req: Request, res: Response) => {
      const code = req.query.code;
      if (!code) {
        return res.send("Error Something went wrong");
      }
      const userData = await fetchUserToken(code);
      const token = await encodeToken(userData);
      res.cookie("token", token, { maxAge: 900000 });
      res.redirect("/");
    });
  }
}
