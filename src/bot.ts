// Must stay the first import: it fills process.env before Config is evaluated.
import "./env";
import { Client, Events, GatewayIntentBits, Message } from "discord.js";
import CommandController from "./CommandController";
import Config from "./Config";
import { sClient } from "./Context";
import TriggerController from "./TriggerController";
import Server from "./web/Server";
import { createLogger } from "./utils/logger";
import { store } from "./Store";
import { startStatusRefresh } from "./db/statusRefresh";
import { startBackupSchedule } from "./db/backup";
import { InteractionHandler } from "./InteractionHandler";

const log = createLogger("Main");
const intents = [
  GatewayIntentBits.Guilds,
  // Privileged. Keeps the guild's member count (/serverinfo/membercount) up to date.
  GatewayIntentBits.GuildMembers,
  // messageCreate for NeeTrigger. No MessageContent: commands are slash commands and
  // the trigger never reads message.content.
  GatewayIntentBits.GuildMessages,
];
class Main {
  private args: string[];
  constructor(args: string[]) {
    this.args = args;
  }

  public async main() {
    const client = new Client({ intents });
    sClient.client = client;
    // Throws if the DB file is missing: build it with `bun run import:firestore`.
    store.init();
    startStatusRefresh(store.tournaments);
    // Only when BACKUP_ENABLED=true; failures are logged, never thrown.
    startBackupSchedule(store.db.$client, store.path);
    const triggerController = new TriggerController();
    const commandController = new CommandController();
    const interactionHandler = new InteractionHandler(client);
    const server = new Server(client);
    if (Config.EnableWebServer) {
      await server.start(+process.env.PORT! || Config.ServerPort);
    }

    client.once(Events.ClientReady, (): void => {
      log("Bot is ready");
    });

    client.on(Events.MessageCreate, (message: Message): void => {
      // Never react to the bot's own messages.
      if (message.author.id === client.user?.id) {
        return;
      }
      triggerController.runTriggers(message);
    });

    client.on(Events.Error, (error) => {
      console.error(error);
      process.exit();
    });

    client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isChatInputCommand()) {
        commandController.handle(interaction).catch(console.error);
        return;
      }
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
bot.main().then(
  () => log("main done"),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
