import { randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { decodeMap, decodeValue, encodeMap, EncodedMap, ExportedDoc, isCollectionExport } from "./codec";

export type SnapshotLogger = (message: string) => void;

const defaultLogger: SnapshotLogger = (message) => console.log(message);

const AUTO_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const autoId = (): string =>
  [...randomBytes(20)].map((b) => AUTO_ID_CHARS[b % AUTO_ID_CHARS.length]).join("");

export interface SnapshotDocumentSnapshot {
  readonly id: string;
  readonly exists: true;
  readonly ref: SnapshotDocRef;
  data(): Record<string, any>;
}

export interface SnapshotQuerySnapshot {
  readonly docs: SnapshotDocumentSnapshot[];
  readonly empty: boolean;
  readonly size: number;
  forEach(fn: (doc: SnapshotDocumentSnapshot) => void): void;
}

export interface SnapshotDocRef {
  readonly id: string;
  readonly path: string;
  get(): Promise<SnapshotDocumentSnapshot | { id: string; exists: false; data(): undefined }>;
  update(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}

/**
 * In-memory stand-in for the subset of a Firestore CollectionReference the
 * caches use (get, add, where("==").get, doc().update/delete), backed by a JSON
 * export. Writes only change this in-memory copy and are logged as
 * "[snapshot] would write ..."; nothing is ever persisted.
 *
 * Every read decodes fresh objects, like Firestore returns fresh data per get(),
 * and writes are encoded with the same rules Firestore applies (a Date becomes a
 * Timestamp, `undefined` is rejected).
 */
export class SnapshotCollection {
  public readonly id: string;
  private readonly docs: Map<string, EncodedMap>;
  private readonly log: SnapshotLogger;

  constructor(id: string, docs: ExportedDoc[], log: SnapshotLogger = defaultLogger) {
    this.id = id;
    this.docs = new Map(docs.map((d) => [d.id, d.data]));
    this.log = log;
  }

  public get path(): string {
    return this.id;
  }

  public async get(): Promise<SnapshotQuerySnapshot> {
    return this.snapshot([...this.docs.keys()]);
  }

  public async add(data: Record<string, unknown>): Promise<SnapshotDocRef> {
    const encoded = encodeMap(data);
    let id = autoId();
    while (this.docs.has(id)) {
      id = autoId();
    }
    this.docs.set(id, encoded);
    this.logWrite("add", id, encoded);
    return this.doc(id);
  }

  public where(field: string, op: string, value: unknown): { get(): Promise<SnapshotQuerySnapshot> } {
    if (op !== "==") {
      throw new Error(`[snapshot] where("${field}", "${op}", ...) is not supported; only "==" is.`);
    }
    return {
      get: async () =>
        this.snapshot(
          [...this.docs.entries()]
            .filter(([, data]) => Object.prototype.hasOwnProperty.call(data, field) && decodeValue(data[field]) === value)
            .map(([id]) => id),
        ),
    };
  }

  public doc(id: string = autoId()): SnapshotDocRef {
    const path = `${this.id}/${id}`;
    return {
      id,
      path,
      get: async () => (this.docs.has(id) ? this.docSnapshot(id) : { id, exists: false as const, data: () => undefined }),
      // Not `async`: like Firestore, invalid data throws synchronously.
      update: (data: Record<string, unknown>) => {
        const encoded = encodeMap(data);
        const existing = this.docs.get(id);
        if (!existing) {
          return Promise.reject(new Error(`[snapshot] No document to update: ${path}`));
        }
        // Shallow merge of top-level fields (dotted field paths are not interpreted).
        this.docs.set(id, { ...existing, ...encoded });
        this.logWrite("update", id, encoded);
        return Promise.resolve();
      },
      delete: async () => {
        this.docs.delete(id);
        this.logWrite("delete", id);
      },
    };
  }

  private snapshot(ids: string[]): SnapshotQuerySnapshot {
    const docs = ids.map((id) => this.docSnapshot(id));
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
  }

  private docSnapshot(id: string): SnapshotDocumentSnapshot {
    const data = this.docs.get(id) as EncodedMap;
    return { id, exists: true, ref: this.doc(id), data: () => decodeMap(data) };
  }

  private logWrite(op: string, id: string, data?: EncodedMap): void {
    this.log(`[snapshot] would write: ${op} ${this.id}/${id}${data ? " " + JSON.stringify(data) : ""} (in memory only)`);
  }
}

/** Reads `<dir>/<collection>.json` from an export made by scripts/export-firestore.ts. */
export const loadSnapshotCollection = (
  dir: string,
  collection: string,
  log: SnapshotLogger = defaultLogger,
): SnapshotCollection => {
  const file = join(dir, `${collection}.json`);
  if (!existsSync(file)) {
    const available = existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "manifest.json")
      : [];
    throw new Error(
      `FIRESTORE_SNAPSHOT: no export for collection "${collection}" at ${file}. ` +
        (existsSync(dir) ? `Available: ${available.join(", ") || "none"}.` : "The directory does not exist.") +
        (collection === "tournaments_dev" ? " Export it with --include-dev." : ""),
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isCollectionExport(parsed) || parsed.collection !== collection) {
    throw new Error(`FIRESTORE_SNAPSHOT: ${file} is not a valid export of collection "${collection}".`);
  }
  return new SnapshotCollection(collection, parsed.docs, log);
};
