import { afterAll, describe, expect, mock, test } from "bun:test";
import { join } from "path";

// test/setup.ts makes firebase-admin throw on import. Swap in recording fakes for
// this file only, and put the blocking mocks back afterwards.
const calls: Record<string, unknown[][]> = { cert: [], initializeApp: [], initializeFirestore: [] };
const record =
  (name: string, result: unknown) =>
  (...args: unknown[]) => {
    calls[name].push(args);
    return result;
  };
const fakeApp = { name: "[DEFAULT]" };
const fakeDb = { kind: "fake-firestore" };
void mock.module("firebase-admin/app", () => ({
  cert: record("cert", "fake-credential"),
  initializeApp: record("initializeApp", fakeApp),
}));
void mock.module("firebase-admin/firestore", () => ({
  initializeFirestore: record("initializeFirestore", fakeDb),
}));

afterAll(() => {
  // The modules are loaded now, so mock.module runs the factory right away: replace
  // every export with one that throws instead of throwing from the factory.
  const forbidden = (name: string) => () => {
    throw new Error(`${name} must not be used in tests (no live Firestore / network). Use a fake.`);
  };
  void mock.module("firebase-admin/app", () => ({
    cert: forbidden("firebase-admin/app"),
    initializeApp: forbidden("firebase-admin/app"),
  }));
  void mock.module("firebase-admin/firestore", () => ({ initializeFirestore: forbidden("firebase-admin/firestore") }));
});

describe("openLiveFirestore", () => {
  test("uses the modular firebase-admin API with the REST transport", async () => {
    const { openLiveFirestore, DEFAULT_KEY_FILE } = await import("../src/liveFirestore");
    expect(DEFAULT_KEY_FILE.endsWith("firebasekey.json")).toBe(true);

    const db = openLiveFirestore(join(import.meta.dir, "fixtures", "fake-service-account.json"));

    expect(db as unknown).toBe(fakeDb);
    expect(calls.cert).toEqual([[expect.objectContaining({ project_id: "fake-project-for-tests" })]]);
    expect(calls.initializeApp).toEqual([[{ credential: "fake-credential" }]]);
    expect(calls.initializeFirestore).toEqual([[fakeApp, { preferRest: true }]]);
  });
});
