// Must stay the first import: it fills process.env before Config is evaluated.
import "./env";
import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import Config from "./Config";
import { sClient } from "./Context";
import MessageHandler from "./MessageHandler";
import Server from "./web/Server";
import { createLogger } from "./utils/logger";
import { store } from "./Store";
import { InteractionHandler } from "./InteractionHandler";

const log = createLogger("Main");
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildExpressions,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  // API v10 only fills message.content with this privileged intent; the prefix
  // commands still parse it.
  GatewayIntentBits.MessageContent,
];
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
    const server = new Server(client);
    if (Config.EnableWebServer) {
      await server.start(+process.env.PORT! || Config.ServerPort);
    }

    client.once(Events.ClientReady, (): void => {
      log("Bot is ready");
    });

    client.on(Events.MessageCreate, (message: Message): void => {
      messageHandler.processMessage(message);
    });

    client.on(Events.Error, (error) => {
      console.error(error);
      process.exit();
    });

    client.on(Events.InteractionCreate, (interaction) => {
      interactionHandler.handle(interaction);
    });

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
