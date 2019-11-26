import { Request, Response, Router } from "express";
import { store } from "../../Store";
import { TournamentStoreCache } from "../../stores";
import { buildICallFile } from "../services/ICallBuilder.service";

export class CalendarRouter {
  private _router: Router;
  private cache: TournamentStoreCache;
  private lastUpdated: number = 0;
  private cachedICal: string;

  private readonly expireTime = 18000000;

  constructor() {
    this._router = Router();
    this.cache = store.cache("tournaments") as TournamentStoreCache;
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {

    // ::GET:: [URL]/calendar/ical
    this._router.get("/tournaments.ics", (req, res) => {
      if ((Date.now() - this.lastUpdated) > this.expireTime) {
        this.cachedICal = buildICallFile(this.cache.getUpcoming());
        this.lastUpdated = Date.now();
      }
      res.setHeader("Content-Type", "text/calendar;charset=utf-8");
      res.status(200).send(this.cachedICal);
    });
  }
}
