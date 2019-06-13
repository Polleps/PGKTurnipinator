import { Request, Response, Router } from "express";
import Config from "../../Config";

export class InviteRouter {
  private _router: Router;
  constructor() {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this._router.get("/", (req, res) => {
      res.redirect(Config.PUBLIC_INVITE_LINK);
    });
  }
}
