import { describe, expect, test } from "bun:test";
import { join } from "path";
import { envFileFor, loadEnvFile } from "../src/envLoader";

const FIXTURE = join(import.meta.dir, "fixtures", "dotenv6.env");

describe("env loader (dotenv 6 semantics)", () => {
  test("keeps $ and # literally, like dotenv 6 (Bun's --env-file would not)", () => {
    const env: Record<string, string | undefined> = {};
    loadEnvFile(FIXTURE, env);
    expect(env.DOLLAR).toBe("ab$cd");
    expect(env.HASH).toBe("a#b");
    expect(env.SPACED).toBe("v # c");
    expect(env.SINGLE).toBe("x$y");
    expect(env.DOUBLE).toBe("p$q");
    expect(env.PREFIX).toBe("$");
    expect(env.URL).toBe("https://example.invalid/?a=1&b=$x");
    expect(Object.keys(env)).not.toContain("# comment line");
  });

  test("does not override variables that are already set", () => {
    const env: Record<string, string | undefined> = { PRESET: "from-shell" };
    const loaded = loadEnvFile(FIXTURE, env);
    expect(env.PRESET).toBe("from-shell");
    expect(loaded).not.toContain("PRESET");
  });

  test("picks .env.prod only for NODE_ENV=production", () => {
    expect(envFileFor("production")).toBe(".env.prod");
    expect(envFileFor(undefined)).toBe(".env.dev");
    expect(envFileFor("development")).toBe(".env.dev");
  });
});
