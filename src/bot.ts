import * as Discord from "discord.js";
import "./env";
import Config from "./Config";
import { sClient, sList } from "./Context";
import ListLoader from "./ListLoader";
import MessageHandler from "./MessageHandler";
import Server from "./web/server";
import * as mongoose from "mongoose";

class Main {

  private args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  public async main() {
    const client = new Discord.Client();
    const lists = await ListLoader.loadLists();
    sClient.client = client;
    sList.lists = lists;
    const messageHandler = new MessageHandler();
    const server = new Server(client);
    if (Config.EnableWebServer) {
      await server.start(Config.ServerPort);
    }
    // mongoose.connect("mongodb://localhost:27017/turnipinator")
    //   .then(() => console.log("MongoDB Connected"))
    //   .catch(() => console.log("MongoDB failed to connect."));
    client.on("ready", (): void => {
      // tslint:disable-next-line:no-console
      console.log("Bot is ready");
    });

    client.on("message", (message: Discord.Message): void => {
      messageHandler.processMessage(message);
    });

    client.login(Config.TestToken);
    return;
  }
}

const bot = new Main([]);
// tslint:disable-next-line:no-console
bot.main().then(() => console.log("main done"));
