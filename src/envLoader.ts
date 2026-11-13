import { readFileSync } from "fs";
import { parse } from "dotenv";

/**
 * Loads .env.prod (NODE_ENV=production) or .env.dev from the repo root, with
 * dotenv 6 semantics, before anything reads process.env (bot.ts imports src/env.ts first).
 *
 * Not Bun's --env-file: Bun expands `$VAR` (even inside quotes) and treats an
 * unquoted `#` as a comment, and has no switch to turn either off. The existing
 * env files contain `$` in COMMAND_PREFIX and OAUTH2_URI, and must stay readable by
 * the Node build for rollback, so they are parsed exactly as dotenv 6 did. Bun's own
 * .env auto-loading is disabled (`env = false` in bunfig.toml, --no-env-file).
 */
export const envFileFor = (nodeEnv: string | undefined): string =>
  nodeEnv === "production" ? ".env.prod" : ".env.dev";

/** dotenv 6 `config()`: variables already set in the environment win. */
export const loadEnvFile = (path: string, env: Record<string, string | undefined> = process.env): string[] => {
  const parsed = parse(readFileSync(path));
  const loaded: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!Object.prototype.hasOwnProperty.call(env, key)) {
      env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
};
