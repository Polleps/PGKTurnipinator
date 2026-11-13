import { existsSync } from "fs";
import { resolve } from "path";
import { envFileFor, loadEnvFile } from "./envLoader";

// Side effect only: bot.ts imports this first. See envLoader.ts for why this isn't --env-file.
const file = resolve(import.meta.dir, "..", envFileFor(process.env.NODE_ENV));
if (existsSync(file)) {
  loadEnvFile(file);
} else {
  console.warn(`env: ${file} not found; using the process environment only.`);
}
