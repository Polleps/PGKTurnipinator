import { readFileSync } from "fs";
import { resolve } from "path";
import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { initializeFirestore, type Firestore } from "firebase-admin/firestore";

export const DEFAULT_KEY_FILE = resolve(import.meta.dir, "..", "firebasekey.json");

/**
 * Initialises firebase-admin against firebasekey.json (the PRODUCTION project).
 * Store requires this module lazily, only in live mode, so snapshot mode never
 * loads firebase-admin or the key.
 *
 * preferRest: firebase-admin is not officially supported on Bun, and its gRPC
 * transport is the part that misbehaves. REST (HTTP/1.1) covers everything the
 * bot does (get/add/update/where); gRPC would only be needed for onSnapshot.
 */
export const openLiveFirestore = (keyFile: string = DEFAULT_KEY_FILE): Firestore => {
  const serviceAccount = JSON.parse(readFileSync(keyFile, "utf8")) as ServiceAccount;
  const app = initializeApp({ credential: cert(serviceAccount) });
  return initializeFirestore(app, { preferRest: true });
};
