import * as Discord from "discord.js";
import "./env";
import Config from "./Config";
import { sClient } from "./Context";
import MessageHandler from "./MessageHandler";
import Server from "./web/Server";
import { createLogger } from "./utils/logger";
import { store } from "./Store";
import { NewsStreamer } from "./NewsStream";

const log = createLogger("Main");
class Main {

  private args: string[];
  constructor(args: string[]) {
    this.args = args;
  }

  public async main() {
    const client = new Discord.Client();
    sClient.client = client;
    await store.init();
    log("Caches Loaded.");
    const messageHandler = new MessageHandler();
    const newsStreamer = new NewsStreamer(client);
    const server = new Server(client);
    if (Config.EnableWebServer) {
      await server.start(+process.env.PORT || Config.ServerPort);
    }

    client.on("ready", (): void => {
      log("Bot is ready");
    });

    client.on("message", (message: Discord.Message): void => {
      messageHandler.processMessage(message);
    });

    client.on("error", (error) => {
      console.error(error);
      process.exit();
    });

    client.on("disconnect", (e) => {
      console.error("Bot disconnected");
      process.exit();
    });

    try {
      await client.login(Config.TestToken);
    } catch (e) {
      console.error(e);
    }
    return;
  }
}
const bot = new Main([]);
// tslint:disable-next-line:no-console
bot.main().then(() => log("main done"));
