import { Request, Response, Router } from "express";
import { verifyActionRequest } from "../services/authorisation.service";
import UserInfoCache from "../UserInfoCache";
import { flair } from "../actions/Flair";

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
      const { body } = req;

      try {
        const token = await verifyActionRequest(body.token);
        const userInfo = await UserInfoCache.get(token.access_token);

        const { action } = body;
        // Todo: Make a factory for different action functions
        flair(userInfo, action.perform, action.role);

        res.status(200).json({ message: "Success" });
      } catch (err) {
        res.send(404).json({ message: err });
      }
    });
  }
}
