/**
 * Preloaded before every test file (see bunfig.toml).
 *
 * The bot no longer uses Firestore; these guards prove it. Any runtime import of the
 * Firebase SDKs fails loudly, and the network client is stubbed out, so tests can only
 * use fakes. Tests open their own in-memory SQLite DBs.
 */
import { mock } from "bun:test";

const forbidden = (name: string) => () => {
  throw new Error(`${name} must not be loaded in tests (no Firestore / network). Use a fake.`);
};

void mock.module("firebase-admin", forbidden("firebase-admin"));
void mock.module("@google-cloud/firestore", forbidden("@google-cloud/firestore"));
void mock.module("firebase-admin/app", forbidden("firebase-admin/app"));
void mock.module("firebase-admin/firestore", forbidden("firebase-admin/firestore"));
// The start.gg/Discord services use the global fetch; any actual call fails.
globalThis.fetch = Object.assign(() => Promise.reject(new Error("Network access is disabled in tests.")), {
  preconnect: () => {},
}) as unknown as typeof fetch;

// Config parses these at import time; give tests harmless defaults.
process.env.NEE_ROLE_IDS ??= "[]";
process.env.NODE_ENV = "test";
// Never the developer's DB file: anything that opens the default store gets an in-memory DB.
process.env.DATABASE_PATH = ":memory:";
