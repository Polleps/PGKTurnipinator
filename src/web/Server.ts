import * as express from "express";
import * as bodyParser from "body-parser";
import * as Discord from "discord.js";
import { UserRouter } from "./routers/User.router";
import { AuthRouter } from "./routers/Auth.router";
import { ActionRouter } from "./routers/Action.router";

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
    // app.use(session({
    //   secret: "eioejfisoejfos",
    //   resave: false,
    //   saveUninitialized: false,
    // }));
    this.setupRoutes();
  }

  private setupRoutes() {
    // const userRouter = new UserRouter();
    const authRouter = new AuthRouter();
    const actionRouter = new ActionRouter();
    // this.app.use("/users", userRouter.router);
    this.app.use("/", express.static("public"));
    this.app.use("/auth", authRouter.router);
    this.app.use("/actions", actionRouter.router);
  }
}
