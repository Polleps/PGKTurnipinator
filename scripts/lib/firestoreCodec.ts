/**
 * Lossless JSON encoding of Firestore document data, shared by the export script
 * (scripts/export-firestore.ts) and the SQLite import (scripts/import-firestore-export.ts).
 *
 * This module must not import firebase-admin or @google-cloud/firestore: the import
 * runs on Bun, where the Firebase SDK is never loaded. The exporter
 * passes the real SDK classes in via `FirestoreTypes`.
 *
 * Plain JSON values (string, finite number, boolean, null, array, map) are written
 * as-is. Everything else becomes a tagged object with a `__fs` key:
 *
 *   { "__fs": "timestamp", "seconds": 1700000000, "nanoseconds": 123000000 }
 *   { "__fs": "geopoint", "latitude": 52.1, "longitude": 5.1 }
 *   { "__fs": "ref", "path": "collection/docId" }
 *   { "__fs": "bytes", "base64": "AQID" }
 *   { "__fs": "number", "value": "NaN" | "Infinity" | "-Infinity" }
 *   { "__fs": "map", "value": { ... } }   // escapes a real map that has a "__fs" key
 */

export const TAG = "__fs";

export type EncodedValue =
  | string
  | number
  | boolean
  | null
  | EncodedValue[]
  | { [key: string]: EncodedValue };

export type EncodedMap = { [key: string]: EncodedValue };

/**
 * The SDK classes the exporter recognises (instanceof checks). Instances must
 * expose seconds/nanoseconds, latitude/longitude and path respectively.
 */
export interface FirestoreTypes {
  Timestamp?: Function;
  GeoPoint?: Function;
  DocumentReference?: Function;
}

// Same constant as @google-cloud/firestore's Timestamp (0001-01-01T00:00:00Z).
const MIN_SECONDS = -62135596800;
const MS_TO_NANOS = 1e6;

/**
 * Stand-in for a Firestore Timestamp: same public API the bot could use
 * (seconds, nanoseconds, toDate, toMillis, isEqual, valueOf) and the same own
 * fields, so JSON.stringify output (e.g. GET /tournaments) matches the real class.
 */
export class SnapshotTimestamp {
  private readonly _seconds: number;
  private readonly _nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }

  public static fromMillis(ms: number): SnapshotTimestamp {
    const seconds = Math.floor(ms / 1000);
    return new SnapshotTimestamp(seconds, Math.floor((ms - seconds * 1000) * MS_TO_NANOS));
  }

  public static fromDate(date: Date): SnapshotTimestamp {
    return SnapshotTimestamp.fromMillis(date.getTime());
  }

  public get seconds(): number {
    return this._seconds;
  }

  public get nanoseconds(): number {
    return this._nanoseconds;
  }

  public toDate(): Date {
    return new Date(this._seconds * 1000 + Math.round(this._nanoseconds / MS_TO_NANOS));
  }

  public toMillis(): number {
    return this._seconds * 1000 + Math.floor(this._nanoseconds / MS_TO_NANOS);
  }

  public isEqual(other: unknown): boolean {
    return (
      other instanceof SnapshotTimestamp &&
      other.seconds === this._seconds &&
      other.nanoseconds === this._nanoseconds
    );
  }

  /** Same lexicographically ordered string as the real Timestamp.valueOf(). */
  public valueOf(): string {
    const formattedSeconds = String(this._seconds - MIN_SECONDS).padStart(12, "0");
    const formattedNanoseconds = String(this._nanoseconds).padStart(9, "0");
    return formattedSeconds + "." + formattedNanoseconds;
  }
}

/** Stand-in for a Firestore GeoPoint (same getters and JSON shape). */
export class SnapshotGeoPoint {
  private readonly _latitude: number;
  private readonly _longitude: number;

  constructor(latitude: number, longitude: number) {
    this._latitude = latitude;
    this._longitude = longitude;
  }

  public get latitude(): number {
    return this._latitude;
  }

  public get longitude(): number {
    return this._longitude;
  }

  public isEqual(other: unknown): boolean {
    return (
      other instanceof SnapshotGeoPoint &&
      other.latitude === this._latitude &&
      other.longitude === this._longitude
    );
  }
}

/**
 * Stand-in for a Firestore DocumentReference. Only carries the path: it cannot
 * be read or written through (nothing in the bot dereferences stored refs).
 */
export class SnapshotDocumentReference {
  public readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  public get id(): string {
    return this.path.split("/").pop() as string;
  }

  public isEqual(other: unknown): boolean {
    return other instanceof SnapshotDocumentReference && other.path === this.path;
  }
}

const isPlainObject = (v: object): boolean => {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const fieldPath = (path: string, key: string | number) =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

/**
 * Encodes one Firestore value. Throws (like Firestore does on write) for
 * `undefined`, functions, symbols and unknown class instances.
 */
export const encodeValue = (value: unknown, types: FirestoreTypes = {}, path: string = ""): EncodedValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }
    return { [TAG]: "number", value: String(value) };
  }
  if (typeof value !== "object") {
    throw new TypeError(`Cannot encode ${typeof value} as a Firestore value (found in field "${path}").`);
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => encodeValue(v, types, fieldPath(path, i)));
  }
  if (value instanceof SnapshotTimestamp || (types.Timestamp && value instanceof types.Timestamp)) {
    const t = value as { seconds: number; nanoseconds: number };
    return { [TAG]: "timestamp", seconds: t.seconds, nanoseconds: t.nanoseconds };
  }
  if (value instanceof Date) {
    // Firestore stores a JS Date as a Timestamp.
    const t = SnapshotTimestamp.fromDate(value);
    return { [TAG]: "timestamp", seconds: t.seconds, nanoseconds: t.nanoseconds };
  }
  if (value instanceof SnapshotGeoPoint || (types.GeoPoint && value instanceof types.GeoPoint)) {
    const g = value as { latitude: number; longitude: number };
    return { [TAG]: "geopoint", latitude: g.latitude, longitude: g.longitude };
  }
  if (value instanceof SnapshotDocumentReference || (types.DocumentReference && value instanceof types.DocumentReference)) {
    return { [TAG]: "ref", path: (value as { path: string }).path };
  }
  if (value instanceof Uint8Array) {
    return { [TAG]: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  if (!isPlainObject(value)) {
    const name = (value as object).constructor?.name ?? "object";
    throw new TypeError(`Cannot encode ${name} as a Firestore value (found in field "${path}").`);
  }
  const map = encodeMap(value as Record<string, unknown>, types, path);
  return Object.prototype.hasOwnProperty.call(map, TAG) ? { [TAG]: "map", value: map } : map;
};

/** Encodes a document's data (a map). */
export const encodeMap = (
  data: Record<string, unknown>,
  types: FirestoreTypes = {},
  path: string = "",
): EncodedMap => {
  const out: EncodedMap = {};
  for (const [key, v] of Object.entries(data)) {
    if (v === undefined) {
      throw new TypeError(`Cannot use "undefined" as a Firestore value (found in field "${fieldPath(path, key)}").`);
    }
    out[key] = encodeValue(v, types, fieldPath(path, key));
  }
  return out;
};

const decodeTagged = (v: { [key: string]: EncodedValue }): unknown => {
  switch (v[TAG]) {
    case "timestamp":
      return new SnapshotTimestamp(v.seconds as number, v.nanoseconds as number);
    case "geopoint":
      return new SnapshotGeoPoint(v.latitude as number, v.longitude as number);
    case "ref":
      return new SnapshotDocumentReference(v.path as string);
    case "bytes":
      return Buffer.from(v.base64 as string, "base64");
    case "number":
      return Number(v.value);
    case "map":
      return decodeMap(v.value as EncodedMap);
    default:
      throw new TypeError(`Unknown ${TAG} tag: ${JSON.stringify(v[TAG])}`);
  }
};

/** Decodes an encoded value into fresh objects (Snapshot* stand-ins for SDK types). */
export const decodeValue = (v: EncodedValue): unknown => {
  if (v === null || typeof v !== "object") {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map(decodeValue);
  }
  if (Object.prototype.hasOwnProperty.call(v, TAG)) {
    return decodeTagged(v);
  }
  return decodeMap(v);
};

export const decodeMap = (data: EncodedMap): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(data)) {
    out[key] = decodeValue(v);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Export file format

export const EXPORT_FORMAT = "turnipinator-firestore-export";
export const EXPORT_VERSION = 1;

export interface ExportedDoc {
  id: string;
  data: EncodedMap;
}

export interface CollectionExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  collection: string;
  exportedAt: string;
  count: number;
  docs: ExportedDoc[];
}

export const isCollectionExport = (x: unknown): x is CollectionExport => {
  const e = x as CollectionExport;
  return (
    typeof e === "object" &&
    e !== null &&
    e.format === EXPORT_FORMAT &&
    e.version === EXPORT_VERSION &&
    typeof e.collection === "string" &&
    Array.isArray(e.docs) &&
    e.docs.every((d) => typeof d?.id === "string" && typeof d.data === "object" && d.data !== null)
  );
};
