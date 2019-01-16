import * as express from "express";
import * as bodyParser from "body-parser";
import * as Discord from "discord.js";
import { UserRouter } from "./routers";

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
    const userRouter = new UserRouter();
    this.app.use("/users", userRouter.router);
  }
}
