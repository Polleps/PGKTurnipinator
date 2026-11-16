import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "export-firestore.ts");

describe("export-firestore script", () => {
  test("contains no Firestore write APIs", () => {
    // Strip comments, then look for any write-ish call.
    const code = readFileSync(SCRIPT, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const api of [
      ".set(",
      ".add(",
      ".update(",
      ".delete(",
      ".create(",
      "batch(",
      "runTransaction",
      "bulkWriter",
      "recursiveDelete",
    ]) {
      expect(code.includes(api)).toBe(false);
    }
    expect(code).toContain(".get()");
  });

  test("without --yes it only prints the plan and writes nothing", () => {
    const out = mkdtempSync(join(tmpdir(), "export-dry-"));
    rmSync(out, { recursive: true });
    const result = Bun.spawnSync(
      ["bun", "--no-env-file", SCRIPT, "--include-dev", `--out=${out}`, "--key=/nonexistent/key.json"],
      {
        env: { PATH: process.env.PATH ?? "" },
      },
    );
    const stdout = result.stdout.toString();
    expect(result.exitCode).toBe(0);
    expect(stdout).toContain("joinableroles, role_categories, tournaments, tournaments_dev");
    expect(stdout).toContain("Dry run: nothing was read");
    expect(existsSync(out)).toBe(false);
  });
});
