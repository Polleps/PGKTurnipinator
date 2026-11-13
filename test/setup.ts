/**
 * Preloaded before every test file (see bunfig.toml).
 *
 * Tests must never touch live Firestore: firebasekey.json is the PRODUCTION
 * project. Any runtime import of the Firebase SDKs fails loudly here, and the
 * network client is stubbed out, so tests can only use fakes.
 */
import { mock } from "bun:test";

const forbidden = (name: string) => () => {
  throw new Error(`${name} must not be loaded in tests (no live Firestore / network). Use a fake.`);
};

mock.module("firebase-admin", forbidden("firebase-admin"));
mock.module("@google-cloud/firestore", forbidden("@google-cloud/firestore"));
// The start.gg/Discord services use the global fetch; any actual call fails.
globalThis.fetch = Object.assign(() => Promise.reject(new Error("Network access is disabled in tests.")), {
  preconnect: () => {},
}) as unknown as typeof fetch;

// Config parses these at import time; give tests harmless defaults.
process.env.BOT_ADMINS ??= "[]";
process.env.NEE_ROLE_IDS ??= "[]";
// The write guard reads NODE_ENV; tests pass it explicitly or assert the default.
process.env.NODE_ENV = "test";
// Anything that imports Store gets snapshot mode on the fake fixture export, so the
// `store` singleton never tries to load firebase-admin.
process.env.FIRESTORE_SNAPSHOT = new URL("./fixtures/firestore-export", import.meta.url).pathname;
process.env.TOURNAMENT_COLLECTION_NAME ??= "tournaments";
