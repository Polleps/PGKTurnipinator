import express from "express";
import * as Discord from "discord.js";
import {
  ActionRouter,
  AuthRouter,
  InviteRouter,
  TournamentRouter,
  TournamentApiRouter,
  CalendarRouter,
  ServerInfoRouter,
} from "./routers";

/** `GET /` goes to the community site; the bot's own home page is gone. */
export const HOME_REDIRECT_URL = "https://smash-nederland.nl";

export default class Server {
  private app!: express.Application;
  private client: Discord.Client;

  constructor(discordClient: Discord.Client) {
    this.client = discordClient;
    this.init();
  }

  /** The express app, for tests that mount the real routes without starting the bot. */
  public get handler(): express.Application {
    return this.app;
  }

  public start(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // listen() never passes an error to its callback; failures (e.g. EADDRINUSE)
      // are emitted as an "error" event on the http.Server.
      const server = this.app.listen(port, () => {
        console.log(`Web server running on port: ${port}`);
        resolve();
      });
      server.once("error", reject);
    });
  }

  private init() {
    this.app = express();
    // support application/json type post data
    this.app.use(express.json());
    // support application/x-www-form-urlencoded post data
    this.app.use(express.urlencoded({ extended: false }));
    this.setupRoutes();
  }

  private setupRoutes() {
    // const userRouter = new UserRouter();
    const authRouter = new AuthRouter();
    const actionRouter = new ActionRouter();
    const inviteRouter = new InviteRouter();
    const tournamentRouter = new TournamentRouter();
    const tournamentApiRouter = new TournamentApiRouter();
    const calendarRouter = new CalendarRouter();
    const serverInfoRouter = new ServerInfoRouter(this.client);

    // Vite's hashed bundles never change, so they can be cached for a year.
    // index.html, the manifest and the service worker keep the default (revalidate).
    const staticOptions = {
      setHeaders: (res: express.Response, filePath: string) => {
        if (/[\\/]assets[\\/]/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    };
    this.app.use("/bot", express.static("public/dist", staticOptions));
    this.app.use("/agenda", express.static("agenda/dist", staticOptions));

    this.app.use("/calendar", calendarRouter.router);
    this.app.use("/auth", authRouter.router);
    this.app.use("/actions", actionRouter.router);
    this.app.use("/invite", inviteRouter.router);
    // Legacy array shape for nsd-site and installed agenda PWAs; new clients use /api/tournaments.
    this.app.use("/tournaments", tournamentRouter.router);
    this.app.use("/api/tournaments", tournamentApiRouter.router);
    this.app.use("/serverinfo", serverInfoRouter.router);
    // 302, not 301: browsers cache a 301 indefinitely, and the target may still change.
    this.app.get("/", (_req, res) => res.redirect(302, HOME_REDIRECT_URL));
  }
}
