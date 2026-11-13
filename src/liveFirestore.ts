import * as admin from "firebase-admin";
import * as serviceAccount from "../firebasekey.json";
import { Firestore } from "@google-cloud/firestore";

/**
 * Initialises firebase-admin against firebasekey.json (the PRODUCTION project).
 * Store requires this module lazily, only in live mode, so snapshot mode never
 * loads firebase-admin or the key.
 */
export const openLiveFirestore = (): Firestore => {
  admin.initializeApp({credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)});
  return admin.firestore();
};
