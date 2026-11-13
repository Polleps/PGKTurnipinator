import { describe, expect, test } from "bun:test";
import { createHmac, generateKeyPairSync, randomBytes } from "crypto";
import { pJWTSign, pJWTVerify, toSigningKey } from "../src/web/services/authorisation.service";

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/**
 * What jsonwebtoken 8 produced for `jwt.sign(stringPayload, bufferKey)`: HS256 over the raw key
 * bytes, with no `typ` header (jsonwebtoken only adds `typ: "JWT"` for object payloads).
 */
const legacyV8Token = (payload: string, rawKey: Buffer) => {
  const signingInput = `${b64url(JSON.stringify({ alg: "HS256" }))}.${b64url(payload)}`;
  return `${signingInput}.${createHmac("sha256", rawKey).update(signingInput).digest("base64url")}`;
};

const session = { access_token: "a", refresh_token: "r", expires: 1767261600000 };

// token.key's real contents are unknown here, so cover both a random secret and a PEM key file.
const keys: Array<[string, Buffer]> = [
  ["random bytes", randomBytes(64)],
  [
    "an RSA private key PEM",
    Buffer.from(
      generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }) as string,
    ),
  ],
];

describe.each(keys)("session JWT with %s as token.key", (_name, raw) => {
  const key = toSigningKey(raw);

  test("round-trips", async () => {
    const token = await pJWTSign(JSON.stringify(session), key);
    await expect(pJWTVerify(token, key)).resolves.toEqual(session);
  });

  test("signs byte-for-byte like jsonwebtoken 8 did", async () => {
    const payload = JSON.stringify(session);
    expect(await pJWTSign(payload, key)).toBe(legacyV8Token(payload, raw));
  });

  test("accepts cookies issued before the upgrade", async () => {
    await expect(pJWTVerify(legacyV8Token(JSON.stringify(session), raw), key)).resolves.toEqual(session);
  });

  test("rejects other algorithms and tampered tokens", async () => {
    const none = `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(session))}.`;
    await expect(pJWTVerify(none, key)).rejects.toBeDefined();
    const token = await pJWTSign(JSON.stringify(session), key);
    const tampered = token.replace(/\.[^.]+\./, `.${b64url(JSON.stringify({ ...session, access_token: "x" }))}.`);
    await expect(pJWTVerify(tampered, key)).rejects.toBeDefined();
  });
});
