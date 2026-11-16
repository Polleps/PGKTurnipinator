import Config from "../../Config";

const APIURL = "https://discord.com/api/v10";
const TOKENURL = "/oauth2/token";
const baseDir = process.cwd();
let tokenKey: Promise<CryptoKey> | undefined;

/**
 * The session JWT is HS256, keyed with the raw bytes of token.key (whatever the file
 * contains, PEM or random bytes), exactly as jsonwebtoken did, so existing sessions stay valid.
 */
export const toSigningKey = (raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const signingKey = (): Promise<CryptoKey> => {
  if (!tokenKey) {
    tokenKey = loadPrivateKey().then(toSigningKey);
    // A failed load (missing token.key) is retried on the next request instead of cached.
    void tokenKey.catch(() => {
      tokenKey = undefined;
    });
  }
  return tokenKey;
};

export const fetchUserToken = async (code: string): Promise<ITokenRespose> => {
  const body = {
    client_id: Config.CLIENTID,
    client_secret: Config.CLIENTSECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: Config.RedirectURI,
    scope: "identify",
  };
  return callTokenEndpoint(body);
};

export const refreshUserToken = async (refresh_token: string): Promise<ITokenRespose> => {
  const body = {
    client_id: Config.CLIENTID,
    client_secret: Config.CLIENTSECRET,
    grant_type: "refresh_token",
    refresh_token,
    redirect_uri: Config.RedirectURI,
    scope: "identify",
  };
  return callTokenEndpoint(body);
};

export const verifyActionRequest = async (token: string): Promise<IDecodedToken> => {
  const payload = await verifyJWT(token, await signingKey());
  const { access_token, refresh_token, expires } = payload;
  const { remember } = payload;
  if (
    typeof access_token !== "string" ||
    typeof refresh_token !== "string" ||
    typeof expires !== "number" ||
    (remember !== undefined && typeof remember !== "boolean")
  ) {
    throw new Error("Invalid session token");
  }
  return payload as unknown as IDecodedToken;
};

/** Signs a session; `remember` says whether its cookie outlives the browser session. */
export const encodeSession = async (session: IDecodedToken): Promise<string> => signJWT({ ...session }, await signingKey());

export const encodeToken = (data: ITokenRespose, remember: boolean): Promise<string> => {
  const { access_token, refresh_token, expires_in } = data;
  return encodeSession({ access_token, refresh_token, expires: Date.now() + expires_in * 1000, remember });
};

/*
 * A minimal HS256 JWT, compatible with what jsonwebtoken produced for this app: header
 * `{"alg":"HS256"}` (no `typ`; jsonwebtoken only adds it for object payloads, and the app
 * signed a JSON string), the payload's JSON as-is, and an HMAC-SHA256 signature.
 */
const HEADER = { alg: "HS256" };
const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString("base64url");
const B64URL_PART = /^[A-Za-z0-9_-]+$/;

export const signJWT = async (payload: Record<string, unknown>, key: CryptoKey): Promise<string> => {
  const signingInput = `${b64url(JSON.stringify(HEADER))}.${b64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(signature))}`;
};

const parseJSONPart = (part: string): unknown => {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
};

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * Verifies an HS256 JWT and returns its payload. Only HS256 is accepted (no `none`, no other
 * algorithm), the signature is checked by Web Crypto (constant-time), and an `exp` claim, if
 * present, must lie in the future.
 */
export const verifyJWT = async (token: string, key: CryptoKey, now = Date.now()): Promise<Record<string, unknown>> => {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3 || !parts.every((p) => B64URL_PART.test(p))) {
    throw new Error("Malformed token");
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJSONPart(headerPart);
  if (!isObject(header) || header.alg !== HEADER.alg || (header.typ !== undefined && header.typ !== "JWT")) {
    throw new Error("Unsupported token header");
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signaturePart, "base64url"),
    encoder.encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) {
    throw new Error("Invalid token signature");
  }
  const payload = parseJSONPart(payloadPart);
  if (!isObject(payload)) {
    throw new Error("Invalid token payload");
  }
  if (payload.exp !== undefined && !(typeof payload.exp === "number" && payload.exp * 1000 > now)) {
    throw new Error("Token expired");
  }
  return payload;
};

// Read as raw bytes, not text: the HMAC key is the file's exact bytes (see toSigningKey).
async function loadPrivateKey(): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return await Bun.file(`${baseDir}/token.key`).bytes();
  } catch (err) {
    console.log(err);
    throw new Error("Could not read token.key, make sure it exists.");
  }
}

const callTokenEndpoint = async (body: Record<string, string>) => {
  const urlencoded = new URLSearchParams();
  Object.keys(body).forEach((key) => urlencoded.append(key, body[key]));
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const res = await fetch(APIURL + TOKENURL, {
    method: "POST",
    headers,
    body: urlencoded,
  });
  return parseTokenResponse(res.status, await res.json().catch(() => undefined));
};

/**
 * Discord answers a failed exchange (bad code, redirect_uri mismatch, wrong secret) with a
 * 4xx and `{ error, error_description }`. Throw instead of passing that on to be signed
 * into a session cookie. The message names only Discord's error fields, never tokens.
 */
export const parseTokenResponse = (status: number, data: unknown): ITokenRespose => {
  const body = (data ?? {}) as Partial<ITokenRespose> & { error?: string; error_description?: string };
  if (status < 200 || status >= 300 || typeof body.access_token !== "string") {
    const reason = [body.error, body.error_description].filter(Boolean).join(": ") || "no access_token";
    throw new Error(`Discord token exchange failed (HTTP ${status}): ${reason}`);
  }
  return body as ITokenRespose;
};

export interface IDecodedToken {
  access_token: string;
  refresh_token: string;
  /** When the Discord access token expires (ms); then it is refreshed. */
  expires: number;
  /** Persistent cookie or session cookie. Missing in tokens issued before it existed. */
  remember?: boolean;
}

export interface ITokenRespose {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
