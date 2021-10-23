import { Client, Intents, Message } from "discord.js";
import "./env";
import Config from "./Config";
import { sClient } from "./Context";
import MessageHandler from "./MessageHandler";
import Server from "./web/Server";
import { createLogger } from "./utils/logger";
import { store } from "./Store";
import { NewsStreamer } from "./NewsStream";
import { InteractionHandler } from "./InteractionHandler";

const log = createLogger("Main");
const intents = [
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
]
class Main {

  private args: string[];
  constructor(args: string[]) {
    this.args = args;
  }

  public async main() {
    const client = new Client({ intents });
    sClient.client = client;
    await store.init();
    log("Caches Loaded.");
    const messageHandler = new MessageHandler();
    const interactionHandler = new InteractionHandler(client);
    const newsStreamer = new NewsStreamer(client);
    const server = new Server(client);
    if (Config.EnableWebServer) {
      await server.start(+process.env.PORT || Config.ServerPort);
    }

    client.once("ready", (): void => {
      log("Bot is ready");
    });

    client.on("messageCreate", (message: Message): void => {
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

    client.on('interactionCreate', (interaction) => {
      interactionHandler.handle(interaction);
    })

    try {
      await client.login(Config.DiscordApplicationToken);
    } catch (e) {
      console.error(e);
    }
    return;
  }
}
const bot = new Main([]);
// tslint:disable-next-line:no-console
bot.main().then(() => log("main done"));
