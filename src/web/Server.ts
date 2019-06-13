import * as express from "express";
import * as bodyParser from "body-parser";
import * as Discord from "discord.js";
import { ActionRouter, AuthRouter, InviteRouter, TournamentRouter } from "./routers";

export default class Server {
  private app: express.Application;
  private client: Discord.Client;

  constructor(discordClient: Discord.Client) {
    this.client = discordClient;
    this.init();
  }

  public start(port: number): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (reason: any) => void) => {
      this.app.listen(port, (err: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Web server running on port: ${port}`);
          resolve();
        }
      });
    });
  }

  private init() {
    this.app = express();
    // support application/json type post data
    this.app.use(bodyParser.json());
    // support application/x-www-form-urlencoded post data
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.setupRoutes();
  }

  private setupRoutes() {
    // const userRouter = new UserRouter();
    const authRouter = new AuthRouter();
    const actionRouter = new ActionRouter();
    const inviteRouter = new InviteRouter();
    const tournamentRouter = new TournamentRouter();
    this.app.use("/bot", express.static("public/dist"));
    this.app.use("/agenda", express.static("agenda/dist"));

    this.app.use("/auth", authRouter.router);
    this.app.use("/actions", actionRouter.router);
    this.app.use("/invite", inviteRouter.router);
    this.app.use("/tournaments", tournamentRouter.router);
  }
}
