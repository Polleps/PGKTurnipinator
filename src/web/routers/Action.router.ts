import { Request, Response, Router } from "express";
import * as jwt from "jsonwebtoken";
import { verifyActionRequest } from "../services/authorisation.service";

export class ActionRouter {
  private _router: Router;
  constructor() {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    this._router.post("/run", async (req: Request, res: Response) => {
      const body = JSON.parse(req.body);
      const token = await verifyActionRequest(body.token);

    });
  }
}
