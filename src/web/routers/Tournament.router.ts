import { Request, Response, Router } from "express";
import { store } from "../../Store";
import { TournamentStoreCache } from "../../stores";
export class TournamentRouter {
  private _router: Router;
  private cache: TournamentStoreCache;
  constructor() {
    this._router = Router();
    this.setupRoutes();
    this.cache = store.cache("tournaments") as TournamentStoreCache;
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    // http://url/tournaments/
    this._router.get("/", (req: Request, res: Response) => {
      res.status(200).send(JSON.stringify(this.cache.data));
    });
  }
}
