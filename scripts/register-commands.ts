/**
 * Manages the bot's slash commands on the configured guild (GUILD_ID). Guild commands
 * only: they update instantly and the bot serves a single guild. Never registers
 * global commands.
 *
 *   bun run commands register            # bulk-overwrite the guild's commands with src/commands/definitions.ts
 *   bun run commands list                # list what Discord has registered on the guild
 *   bun run commands remove <name...>    # delete these commands
 *   bun run commands remove --all        # delete all of the bot's commands on the guild (rollback)
 *   bun run commands print               # print the registration JSON; no network
 *
 * Uses .env.dev, or .env.prod with NODE_ENV=production (src/env.ts). The application
 * ID is looked up from the bot token, so it always matches the bot that answers.
 * Register after the new bot is up: a running build without slash command support
 * answers them with "This interaction failed".
 */
import "../src/env";
import { REST, Routes, type RESTGetAPIApplicationGuildCommandsResult } from "discord.js";
import Config from "../src/Config";
import { commandsJSON } from "../src/commands/definitions";

const usage = () => {
  console.error("Usage: bun run commands <register|list|remove <name...>|remove --all|print>");
  process.exit(2);
};

const describe = (commands: RESTGetAPIApplicationGuildCommandsResult) => {
  if (commands.length === 0) {
    console.log("  (none)");
  }
  for (const c of commands) {
    const options = (c.options ?? []).map((o) => `${o.name}${o.required ? "" : "?"}`).join(", ");
    const perms = c.default_member_permissions == null ? "everyone" : `perms=${c.default_member_permissions}`;
    console.log(`  /${c.name}${options ? ` [${options}]` : ""}  (${perms}, id ${c.id})`);
  }
};

const main = async () => {
  const [action, ...args] = process.argv.slice(2);

  if (action === "print") {
    console.log(JSON.stringify(commandsJSON(), null, 2));
    return;
  }
  if (!action || !["register", "list", "remove"].includes(action)) {
    usage();
  }

  const token = Config.DiscordApplicationToken;
  const guildId = Config.GUILD_ID;
  if (!token || !guildId) {
    throw new Error("TOKEN and GUILD_ID must be set (see src/env.ts for which env file is loaded).");
  }

  const rest = new REST().setToken(token);
  const app = (await rest.get(Routes.currentApplication())) as { id: string; name: string };
  const route = Routes.applicationGuildCommands(app.id, guildId);
  console.log(`Application "${app.name}", guild ${guildId} (NODE_ENV=${process.env.NODE_ENV ?? "unset"})`);

  if (action === "register") {
    const registered = (await rest.put(route, { body: commandsJSON() })) as RESTGetAPIApplicationGuildCommandsResult;
    console.log(`Registered ${registered.length} commands:`);
    describe(registered);
    return;
  }

  const existing = (await rest.get(route)) as RESTGetAPIApplicationGuildCommandsResult;

  if (action === "list") {
    console.log(`${existing.length} commands registered:`);
    describe(existing);
    return;
  }

  // remove
  if (args.length === 0) {
    usage();
  }
  if (args.includes("--all")) {
    await rest.put(route, { body: [] });
    console.log(`Removed all ${existing.length} commands.`);
    return;
  }
  for (const name of args) {
    const command = existing.find((c) => c.name === name);
    if (!command) {
      console.warn(`  /${name} is not registered; skipped.`);
      continue;
    }
    await rest.delete(Routes.applicationGuildCommand(app.id, guildId, command.id));
    console.log(`  removed /${name}`);
  }
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
