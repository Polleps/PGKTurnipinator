import { describe, expect, test } from "bun:test";
import { createHmac, generateKeyPairSync, randomBytes } from "crypto";
import { signJWT, toSigningKey, verifyJWT } from "../src/web/services/authorisation.service";

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");
const hs256 = (signingInput: string, rawKey: Buffer, alg = "sha256") =>
  `${signingInput}.${createHmac(alg, rawKey).update(signingInput).digest("base64url")}`;

/**
 * What jsonwebtoken (8 and 9) produced for `jwt.sign(JSON.stringify(session), key)`: HS256 over
 * the raw key bytes, with no `typ` header (it only adds `typ: "JWT"` for object payloads).
 */
const legacyToken = (payload: string, rawKey: Buffer) =>
  hs256(`${b64url(JSON.stringify({ alg: "HS256" }))}.${b64url(payload)}`, rawKey);

/** The error a promise rejects with (fails the test if it resolves). */
const rejection = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (e) {
    return e as Error;
  }
  throw new Error("expected the promise to reject");
};

const session = { access_token: "a", refresh_token: "r", expires: 1767261600000 };

describe("a token issued by the jsonwebtoken-based code", () => {
  // Generated once with the old jsonwebtoken 9 code (pJWTSign + createSecretKey) and this test key.
  const fixtureKey = Buffer.from("test-only-session-key, not the real token.key");
  const fixture =
    "eyJhbGciOiJIUzI1NiJ9.eyJhY2Nlc3NfdG9rZW4iOiJmaXh0dXJlLWFjY2VzcyIsInJlZnJlc2hfdG9rZW4iOiJmaXh0dXJlLXJlZnJlc2giLCJleHBpcmVzIjoxNzY3MjYxNjAwMDAwfQ.1ePyrG6ahKbSrZKMcJF6B9vaz6r1XRGE3dC4YbM5hT4";
  const fixturePayload = { access_token: "fixture-access", refresh_token: "fixture-refresh", expires: 1767261600000 };

  test("still verifies", async () => {
    expect(await verifyJWT(fixture, await toSigningKey(fixtureKey))).toEqual(fixturePayload);
  });

  test("is reproduced byte-for-byte", async () => {
    expect(await signJWT(fixturePayload, await toSigningKey(fixtureKey))).toBe(fixture);
  });

  test("does not verify with another key", async () => {
    expect((await rejection(verifyJWT(fixture, await toSigningKey(randomBytes(32))))).message).toContain("signature");
  });
});

// token.key's real contents are unknown here, so cover both a random secret and a PEM key file.
const keys: Array<[string, Buffer<ArrayBuffer>]> = [
  ["random bytes", randomBytes(64)],
  [
    "an RSA private key PEM",
    Buffer.from(
      generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }) as string,
    ),
  ],
];

describe.each(keys)("session JWT with %s as token.key", (_name, raw) => {
  const key = () => toSigningKey(raw);

  test("round-trips", async () => {
    const token = await signJWT(session, await key());
    expect(await verifyJWT(token, await key())).toEqual(session);
  });

  test("signs like jsonwebtoken did", async () => {
    expect(await signJWT(session, await key())).toBe(legacyToken(JSON.stringify(session), raw));
  });

  test("accepts a typ: JWT header", async () => {
    const token = hs256(
      `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(session))}`,
      raw,
    );
    expect(await verifyJWT(token, await key())).toEqual(session);
  });

  test("rejects a tampered payload or signature", async () => {
    const token = await signJWT(session, await key());
    const [h, , s] = token.split(".");
    const otherPayload = `${h}.${b64url(JSON.stringify({ ...session, access_token: "x" }))}.${s}`;
    expect((await rejection(verifyJWT(otherPayload, await key()))).message).toContain("signature");
    const flipped = s.startsWith("A") ? `B${s.slice(1)}` : `A${s.slice(1)}`;
    expect((await rejection(verifyJWT(`${h}.${token.split(".")[1]}.${flipped}`, await key()))).message).toContain(
      "signature",
    );
  });

  test("rejects alg none and other algorithms", async () => {
    const payload = b64url(JSON.stringify(session));
    const none = `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${payload}.`;
    expect(await rejection(verifyJWT(none, await key()))).toBeInstanceOf(Error);
    const noneWithSig = hs256(`${b64url(JSON.stringify({ alg: "none" }))}.${payload}`, raw);
    expect((await rejection(verifyJWT(noneWithSig, await key()))).message).toContain("header");
    const hs512 = hs256(`${b64url(JSON.stringify({ alg: "HS512" }))}.${payload}`, raw, "sha512");
    expect((await rejection(verifyJWT(hs512, await key()))).message).toContain("header");
  });

  test("rejects an expired exp claim and accepts a future one", async () => {
    const now = Date.parse("2026-11-16T12:00:00Z");
    const expired = await signJWT({ ...session, exp: now / 1000 - 1 }, await key());
    expect((await rejection(verifyJWT(expired, await key(), now))).message).toContain("expired");
    const valid = await signJWT({ ...session, exp: now / 1000 + 60 }, await key());
    expect(await verifyJWT(valid, await key(), now)).toMatchObject(session);
    const bogusExp = await signJWT({ ...session, exp: "never" }, await key());
    expect((await rejection(verifyJWT(bogusExp, await key(), now))).message).toContain("expired");
  });

  test("rejects malformed input", async () => {
    for (const bad of ["", "a.b", "a.b.c.d", "not a jwt", "..", undefined as unknown as string]) {
      expect(await rejection(verifyJWT(bad, await key()))).toBeInstanceOf(Error);
    }
  });
});
