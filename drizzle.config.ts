import { defineConfig } from "drizzle-kit";

// `bun run db:generate` writes a new SQL migration after a change to the schema.
// The bot applies pending migrations at startup; the import script builds a fresh DB with them.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
