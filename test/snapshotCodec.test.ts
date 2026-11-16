import { describe, expect, test } from "bun:test";
import {
  decodeMap,
  decodeValue,
  encodeMap,
  encodeValue,
  SnapshotDocumentReference,
  SnapshotGeoPoint,
  SnapshotTimestamp,
} from "../scripts/lib/firestoreCodec";

// Hand-built stand-ins for the SDK classes (firebase-admin is blocked in tests).
class FakeTimestamp {
  constructor(
    public seconds: number,
    public nanoseconds: number,
  ) {}
}
class FakeGeoPoint {
  constructor(
    public latitude: number,
    public longitude: number,
  ) {}
}
class FakeRef {
  constructor(public path: string) {}
}
const types = { Timestamp: FakeTimestamp, GeoPoint: FakeGeoPoint, DocumentReference: FakeRef };

const tagged = {
  title: "x",
  n: 1.5,
  ok: true,
  none: null,
  list: [1, "two", { __fs: "timestamp", seconds: 1, nanoseconds: 2 }],
  ts: { __fs: "timestamp", seconds: 1546344000, nanoseconds: 500000000 },
  neg: { __fs: "timestamp", seconds: -1, nanoseconds: 999999999 },
  geo: { __fs: "geopoint", latitude: 52.0907, longitude: -5.1214 },
  ref: { __fs: "ref", path: "organizers/abc" },
  bytes: { __fs: "bytes", base64: "AQID/w==" },
  nan: { __fs: "number", value: "NaN" },
  inf: { __fs: "number", value: "-Infinity" },
  nested: { deep: { ts: { __fs: "timestamp", seconds: 0, nanoseconds: 0 } } },
  escaped: { __fs: "map", value: { __fs: "user data", other: 1 } },
};

describe("snapshot codec", () => {
  test("decode then encode is lossless", () => {
    const decoded = decodeMap(tagged as any);
    expect(encodeMap(decoded)).toEqual(tagged as any);
    // ...and survives a JSON round trip of the tagged form.
    expect(encodeMap(decodeMap(JSON.parse(JSON.stringify(tagged))))).toEqual(tagged as any);
  });

  test("decodes to equivalent objects", () => {
    const d = decodeMap(tagged as any) as Record<string, any>;
    expect(d.ts).toBeInstanceOf(SnapshotTimestamp);
    expect(d.ts.seconds).toBe(1546344000);
    expect(d.ts.nanoseconds).toBe(500000000);
    expect(d.ts.toMillis()).toBe(1546344000500);
    expect(d.ts.toDate().toISOString()).toBe("2019-01-01T12:00:00.500Z");
    expect(d.geo).toBeInstanceOf(SnapshotGeoPoint);
    expect([d.geo.latitude, d.geo.longitude]).toEqual([52.0907, -5.1214]);
    expect(d.ref).toBeInstanceOf(SnapshotDocumentReference);
    expect(d.ref.path).toBe("organizers/abc");
    expect(d.ref.id).toBe("abc");
    expect([...d.bytes]).toEqual([1, 2, 3, 255]);
    expect(Number.isNaN(d.nan)).toBe(true);
    expect(d.inf).toBe(-Infinity);
    expect(d.escaped).toEqual({ __fs: "user data", other: 1 });
    expect(d.nested.deep.ts.toMillis()).toBe(0);
  });

  test("encodes SDK instances via the passed-in classes", () => {
    const encoded = encodeMap(
      {
        ts: new FakeTimestamp(10, 20),
        geo: new FakeGeoPoint(1, 2),
        ref: new FakeRef("a/b"),
        arr: [new FakeTimestamp(0, 1)],
      },
      types,
    );
    expect(encoded).toEqual({
      ts: { __fs: "timestamp", seconds: 10, nanoseconds: 20 },
      geo: { __fs: "geopoint", latitude: 1, longitude: 2 },
      ref: { __fs: "ref", path: "a/b" },
      arr: [{ __fs: "timestamp", seconds: 0, nanoseconds: 1 }],
    });
    const back = decodeMap(encoded) as Record<string, any>;
    expect(back.ts.seconds).toBe(10);
    expect(back.ts.nanoseconds).toBe(20);
  });

  test("a Date is written as a Timestamp, like Firestore does", () => {
    expect(encodeValue(new Date("2019-01-01T12:00:00.500Z"))).toEqual({
      __fs: "timestamp",
      seconds: 1546344000,
      nanoseconds: 500000000,
    });
  });

  test("rejects values Firestore would reject", () => {
    expect(() => encodeMap({ a: undefined })).toThrow(/undefined/);
    expect(() => encodeMap({ a: { b: () => 1 } })).toThrow(/a\.b/);
    expect(() => encodeMap({ a: new FakeTimestamp(1, 2) })).toThrow(/FakeTimestamp/); // no types passed
    expect(() => decodeValue({ __fs: "mystery" })).toThrow(/Unknown __fs tag/);
  });

  test("SnapshotTimestamp matches the real Timestamp's JSON shape and ordering", () => {
    const a = new SnapshotTimestamp(1, 5);
    const b = new SnapshotTimestamp(2, 0);
    const neg = new SnapshotTimestamp(-10, 0);
    expect(JSON.parse(JSON.stringify(a))).toEqual({ _seconds: 1, _nanoseconds: 5 });
    expect(a < b).toBe(true);
    expect(neg < a).toBe(true);
    expect(a.isEqual(new SnapshotTimestamp(1, 5))).toBe(true);
    expect(SnapshotTimestamp.fromMillis(1500).toMillis()).toBe(1500);
    expect(JSON.parse(JSON.stringify(new SnapshotGeoPoint(1, 2)))).toEqual({ _latitude: 1, _longitude: 2 });
  });
});
