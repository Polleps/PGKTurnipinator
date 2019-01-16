import * as express from "express";

export class UserRouter {
  private _router: express.Router;

  constructor() {
    this._router = express.Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this._router.get("/create/:refID", (req: express.Request, res: express.Response) => {
      res.send("Hey");
    });
  }

}
