/**
 * One-time helper to test /postflairtext and the role selector on the TEST guild,
 * which doesn't have the production character icon roles.
 *
 *   bun --no-env-file scripts/seed-test-roles.ts          # create roles, write the derived snapshot
 *   bun --no-env-file scripts/seed-test-roles.ts --undo   # delete the roles this script created
 *
 * Reads the local export in data/firestore-export/latest/ (never modified) and never
 * touches Firestore. The icon roles are the joinableroles docs whose id starts with
 * `joinablerole.` and whose category is `Icons`. For each one a role with the same
 * name is created on GUILD_ID, or an existing role with that name is reused.
 *
 * Writes data/firestore-export/test-guild/: a copy of latest/ that keeps only the icon
 * roles (pointing at the test guild's role IDs) and the Icons category, so
 * /postflairtext posts only the icon selector, as in production. Non-icon roles are
 * dropped because their production role IDs don't exist on the test guild. The roles
 * this script created are listed in seeded-roles.json there; --undo deletes only those.
 *
 * Refuses to run with NODE_ENV=production, or when GUILD_ID/TOKEN don't come from .env.dev.
 */
import "../src/env";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
import { parse } from "dotenv";
import { Client, GatewayIntentBits, GuildPremiumTier, type Guild } from "discord.js";
import { envFileFor } from "../src/envLoader";
import type { ExportedDoc } from "./lib/firestoreCodec";

const ROOT = resolve(import.meta.dir, "..");
const SOURCE_DIR = join(ROOT, "data/firestore-export/latest");
const TARGET_DIR = join(ROOT, "data/firestore-export/test-guild");
const SEEDED_FILE = join(TARGET_DIR, "seeded-roles.json");

const ICON_ID_PREFIX = "joinablerole.";
const ICON_CATEGORY = "Icons";
const SEED_REASON = "seed-test-roles: test copy of a production icon role";

interface CollectionExport {
  collection: string;
  count: number;
  docs: ExportedDoc[];
}

interface SeededRole {
  name: string;
  id: string;
}

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const readExport = (dir: string, collection: string): CollectionExport =>
  JSON.parse(readFileSync(join(dir, `${collection}.json`), "utf8"));

const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

const readSeeded = (): SeededRole[] =>
  existsSync(SEEDED_FILE) ? (JSON.parse(readFileSync(SEEDED_FILE, "utf8")).roles as SeededRole[]) : [];

const safetyCheck = (): { token: string; guildId: string } => {
  if (process.env.NODE_ENV === "production") {
    fail("Refusing to run: NODE_ENV=production. This script is for the test guild only.");
  }
  const devFile = join(ROOT, envFileFor(process.env.NODE_ENV));
  if (!devFile.endsWith(".env.dev") || !existsSync(devFile)) {
    fail("Refusing to run: .env.dev not found.");
  }
  const dev = parse(readFileSync(devFile));
  const { GUILD_ID: guildId, TOKEN: token } = process.env;
  if (!guildId || !token || guildId !== dev.GUILD_ID || token !== dev.TOKEN) {
    fail("Refusing to run: GUILD_ID and TOKEN must come from .env.dev (unset them in the shell).");
  }
  return { token: token!, guildId: guildId! };
};

const connect = async (token: string, guildId: string): Promise<{ client: Client; guild: Guild }> => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  await new Promise<void>((done) => (client.isReady() ? done() : client.once("clientReady", () => done())));
  const guild = await client.guilds.fetch(guildId);
  await guild.roles.fetch();
  return { client, guild };
};

const seed = async () => {
  const roles = readExport(SOURCE_DIR, "joinableroles");
  const categories = readExport(SOURCE_DIR, "role_categories");

  const iconRoles = roles.docs.filter((d) => d.id.startsWith(ICON_ID_PREFIX) && d.data.category === ICON_CATEGORY);
  const prefixed = roles.docs.filter((d) => d.id.startsWith(ICON_ID_PREFIX)).length;
  const iconCategories = categories.docs.filter((d) => d.data.name === ICON_CATEGORY);
  console.log(
    `Icon roles: ${iconRoles.length} (of ${roles.docs.length} joinableroles; ${prefixed} have the id prefix). ` +
      `Icon categories: ${iconCategories.length}.`,
  );
  if (iconRoles.length === 0 || iconCategories.length !== 1) {
    fail("Unexpected export contents; nothing done.");
  }

  const { token, guildId } = safetyCheck();
  const { client, guild } = await connect(token, guildId);
  try {
    // Role icons need boost level 2. The export has no icon or color data anyway.
    const iconsPossible = guild.premiumTier >= GuildPremiumTier.Tier2 || guild.features.includes("ROLE_ICONS");
    console.log(
      `Guild "${guild.name}": role icons ${iconsPossible ? "possible" : "NOT possible (needs boost level 2)"}.`,
    );

    const previouslySeeded = readSeeded();
    const seeded = new Map(previouslySeeded.map((r) => [r.id, r]));
    const roleIdByName = new Map<string, string>();
    let created = 0;
    let reused = 0;

    for (const doc of iconRoles) {
      const name = doc.data.name as string;
      const existing = guild.roles.cache.find((r) => r.name === name);
      if (existing) {
        roleIdByName.set(name, existing.id);
        reused++;
        continue;
      }
      // Color/icon copied only if the data had them; it has neither.
      const color = typeof doc.data.color === "number" ? doc.data.color : undefined;
      const role = await guild.roles.create({
        name,
        reason: SEED_REASON,
        ...(color ? { colors: { primaryColor: color } } : {}),
      });
      roleIdByName.set(name, role.id);
      seeded.set(role.id, { name, id: role.id });
      created++;
      console.log(`  created ${name}`);
    }

    mkdirSync(TARGET_DIR, { recursive: true });
    for (const file of readdirSync(SOURCE_DIR)) {
      if (file.endsWith(".json") && file !== "joinableroles.json" && file !== "role_categories.json") {
        copyFileSync(join(SOURCE_DIR, file), join(TARGET_DIR, file));
      }
    }
    const derivedRoles = iconRoles.map((d) => ({
      id: d.id,
      data: { ...d.data, ID: roleIdByName.get(d.data.name as string)! },
    }));
    writeJson(join(TARGET_DIR, "joinableroles.json"), { ...roles, count: derivedRoles.length, docs: derivedRoles });
    writeJson(join(TARGET_DIR, "role_categories.json"), {
      ...categories,
      count: iconCategories.length,
      docs: iconCategories,
    });

    const manifestFile = join(TARGET_DIR, "manifest.json");
    if (existsSync(manifestFile)) {
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      manifest.counts = {
        ...manifest.counts,
        joinableroles: derivedRoles.length,
        role_categories: iconCategories.length,
      };
      manifest.derivedFrom = "latest";
      manifest.note = `Icon roles remapped to test guild ${guildId}; non-icon roles and categories dropped.`;
      writeJson(manifestFile, manifest);
    }
    writeJson(SEEDED_FILE, { guildId, roles: [...seeded.values()] });

    console.log(
      `\nRoles created: ${created}. Roles reused: ${reused}.` +
        `\nBuild a test DB from it: bun run import:firestore ${relative(ROOT, TARGET_DIR)} --db=data/test-guild.db`,
    );
  } finally {
    await client.destroy();
  }
};

const undo = async () => {
  if (!existsSync(SEEDED_FILE)) {
    fail(`Nothing to undo: ${SEEDED_FILE} not found.`);
  }
  const record = JSON.parse(readFileSync(SEEDED_FILE, "utf8")) as { guildId: string; roles: SeededRole[] };
  const { token, guildId } = safetyCheck();
  if (record.guildId !== guildId) {
    fail(`Refusing to undo: roles were seeded on guild ${record.guildId}, not ${guildId}.`);
  }

  const { client, guild } = await connect(token, guildId);
  // Dropped from the record: deleted now, or already gone from the guild.
  const done = new Set<string>();
  let deleted = 0;
  try {
    for (const seeded of record.roles) {
      const role = guild.roles.cache.get(seeded.id);
      if (!role) {
        done.add(seeded.id);
        continue;
      }
      if (role.name !== seeded.name) {
        console.warn(`  skipped ${seeded.id}: renamed to "${role.name}" since seeding`);
        continue;
      }
      try {
        await role.delete("seed-test-roles --undo");
        done.add(seeded.id);
        deleted++;
        console.log(`  deleted ${seeded.name}`);
      } catch (e) {
        console.error(`  failed to delete ${seeded.name}:`, e);
      }
    }
  } finally {
    const remaining = record.roles.filter((r) => !done.has(r.id));
    writeJson(SEEDED_FILE, { guildId, roles: remaining });
    await client.destroy();
    console.log(`\nRoles deleted: ${deleted}. Still recorded: ${remaining.length}.`);
  }
};

const args = process.argv.slice(2);
if (args.some((a) => a !== "--undo")) {
  fail("Usage: bun --no-env-file scripts/seed-test-roles.ts [--undo]");
}
await (args.includes("--undo") ? undo() : seed());
