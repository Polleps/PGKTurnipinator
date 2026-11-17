import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");

describe("Firestore is gone from the bot runtime", () => {
  test("nothing under src/ imports firebase-admin or @google-cloud/firestore", () => {
    const offenders = [...new Glob("src/**/*.ts").scanSync(ROOT)].filter((file) =>
      /from\s+["'](firebase-admin|@google-cloud\/firestore)|require\(["'](firebase-admin|@google-cloud\/firestore)/.test(
        readFileSync(join(ROOT, file), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  test("firebase-admin is only a devDependency (for scripts/export-firestore.ts), pinned", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies["firebase-admin"]).toBeUndefined();
    expect(pkg.devDependencies["firebase-admin"]).toBe("14.5.1");
  });
});
