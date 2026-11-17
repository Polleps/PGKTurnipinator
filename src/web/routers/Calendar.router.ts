import { Router } from "express";
import { store } from "../../Store";
import type { TournamentRepository } from "../../db/TournamentRepository";
import { buildICallFile } from "../services/ICallBuilder.service";

export class CalendarRouter {
  private _router: Router;
  private lastUpdated: number = 0;
  private cachedICal!: string;
  /** The repository revision the cached feed was built from; a post or delete rebuilds it. */
  private cachedRevision = -1;

  private readonly expireTime = 18000000;

  constructor(private readonly repo: () => TournamentRepository = () => store.tournaments) {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    // ::GET:: [URL]/calendar/tournaments.ics
    this._router.get("/tournaments.ics", (req, res) => {
      const repo = this.repo();
      if (Date.now() - this.lastUpdated > this.expireTime || repo.revision !== this.cachedRevision) {
        this.cachedRevision = repo.revision;
        this.cachedICal = buildICallFile(repo.upcoming());
        this.lastUpdated = Date.now();
      }
      res.setHeader("Content-Type", "text/calendar;charset=utf-8");
      res.status(200).send(this.cachedICal);
    });
  }
}
