/**
 * Local data-safety guard: keeps non-production runs from writing to Firestore.
 *
 * firebasekey.json points at the PRODUCTION Firebase project, so any run that is
 * not the production bot must treat Firestore as read-only. The only exception is
 * the partial `tournaments_dev` collection, which exists for local testing.
 *
 * This fails closed: an unset or mistyped NODE_ENV leaves every other collection
 * read-only.
 */
export const DEV_WRITABLE_COLLECTIONS: ReadonlySet<string> = new Set(["tournaments_dev"]);

export const isProduction = (nodeEnv: string | undefined = process.env.NODE_ENV): boolean =>
  nodeEnv === "production";

export const isCollectionWritable = (
  collectionId: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean => isProduction(nodeEnv) || DEV_WRITABLE_COLLECTIONS.has(collectionId);

export class ReadOnlyCollectionError extends Error {
  constructor(public readonly collectionId: string, operation: string) {
    super(
      `Refusing to ${operation} collection "${collectionId}": it is read-only outside NODE_ENV=production. ` +
        `Only ${[...DEV_WRITABLE_COLLECTIONS].join(", ")} may be written by local/test runs.`,
    );
    this.name = "ReadOnlyCollectionError";
  }
}
