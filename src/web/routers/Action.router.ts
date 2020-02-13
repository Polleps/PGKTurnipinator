import { Request, Response, Router } from "express";
import { verifyActionRequest, refreshUserToken, encodeToken } from "../services/authorisation.service";
import UserInfoCache from "../UserInfoCache";
import ActionService from "../services/action.service";
import { IAction } from "../actions/IAction";
import { IUserInfo } from "../discord.agent";
import { fetchTournamentDetails } from "../services/smashgg.service";
import { userCanFetchTournament } from "../services/access.service";

export class ActionRouter {
  private _router: Router;
  private actionService: ActionService;

  constructor() {
    this._router = Router();
    this.actionService = new ActionService();

    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {

    // ::AUTH MIDDLEWHERE
    this._router.use((async (req: Request, res: Response, next) => {
      const { body } = req;
      try {
        let token = await verifyActionRequest(body.token);
        if (token.expires <= Date.now()) {
          const userData = await refreshUserToken(token.refresh_token);
          const newToken = await encodeToken(userData);
          token = await verifyActionRequest(newToken);
          const expire = 31536000000; // 1yr in ms.
          res.cookie("token", newToken, { maxAge: expire, path: "/bot/"});
        }

        const userInfo = await UserInfoCache.get(token.access_token);
        res.locals.userInfo = userInfo;
        next();

      } catch (e) {
        console.error(e);
        res.status(400).json({ message: "Could not authenticate." });
      }
    }));

    // ::POST:: [URL]/actions/run
    this._router.post("/run", async (req: Request, res: Response) => {
      const { body } = req;
      const userInfo = res.locals.userInfo as IUserInfo;
      const action = body.action as IAction;
      try {
        const message = await this.actionService.run(userInfo, action);
        res.status(200).json({ message });
      } catch (e) {
        res.status(200).json({error: true, message: e.message});
      }
    });

    this._router.use("/tournamentdetails", async (req: Request, res: Response, next) => {
      if (userCanFetchTournament(res.locals.userInfo as IUserInfo)) {
        next();
      } else {
        res.status(400).send({error: true, message: "User is not permitted"});
      }
    });

    this._router.post("/tournamentdetails/:slug", async (req: Request, res: Response) => {
      try {
        const details = await fetchTournamentDetails(req.params.slug);
        res.status(200).json({message: "success", data: details});
      } catch (e) {
        console.error(e);
        res.status(400).json({message: "invalid tournament", error: true});
      }
    });
  }
}
