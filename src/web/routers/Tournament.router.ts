import { Request, Response, Router } from "express";
import { store } from "../../Store";
import type { TournamentRepository } from "../../db/TournamentRepository";
import { toLegacyTournament } from "../../db/legacyTournament";

/**
 * Legacy `GET /tournaments`: every tournament as one JSON array, in the old camelCase shape.
 * nsd-site and installed agenda PWAs still call it; keep it until they have moved.
 */
export class TournamentRouter {
  private _router: Router;

  constructor(private readonly repo: () => TournamentRepository = () => store.tournaments) {
    this._router = Router();
    this.setupRoutes();
  }

  public get router() {
    return this._router;
  }

  private setupRoutes() {
    // http://url/tournaments/
    this._router.get("/", (req: Request, res: Response) => {
      res.status(200).send(JSON.stringify(this.repo().all().map(toLegacyTournament)));
    });
  }
}
