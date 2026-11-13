import * as jwt from "jsonwebtoken";
import Config from "../../Config";
import { createSecretKey, KeyObject } from "crypto";

const APIURL = "https://discord.com/api/v10";
const TOKENURL = "/oauth2/token";
const baseDir = process.cwd();
let tokenKey: KeyObject | undefined;

/**
 * The session JWT is HS256, keyed with the raw bytes of token.key. jsonwebtoken 9
 * rejects asymmetric (PEM) keys for HS* algorithms, so wrap the bytes as a secret
 * KeyObject explicitly: this keeps the exact v8 behavior (HMAC over the file's bytes)
 * whatever the file contains, so existing cookies stay valid.
 */
export const toSigningKey = (raw: Buffer): KeyObject => createSecretKey(raw);
const ALGORITHM = "HS256";

export const fetchUserToken = async (code: string): Promise<ITokenRespose> => {
  // TODO: State checking in token request.
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
  // TODO: State checking in token request.
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
  if (!tokenKey) {
    tokenKey = toSigningKey(await loadPrivateKey());
  }
  return pJWTVerify(token, tokenKey);
};

export const encodeToken = async (data: ITokenRespose) => {
  if (!tokenKey) {
    tokenKey = toSigningKey(await loadPrivateKey());
  }
  const { access_token, refresh_token, expires_in } = data;
  const tokenData = { access_token, refresh_token, expires: Date.now() + (expires_in * 1000) };
  // const tokenData = { access_token, refresh_token, expires: Date.now() + (1 * 1000) };

  return pJWTSign(JSON.stringify(tokenData), tokenKey);
};

export const pJWTVerify = (token: string, secret: KeyObject): Promise<IDecodedToken> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, { algorithms: [ALGORITHM] }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data as unknown as IDecodedToken);
      }
    });
  });
};

export const pJWTSign = (payload: string, key: KeyObject): Promise<string> => {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, key, { algorithm: ALGORITHM }, (err, token) => {
      if (err) {
        reject(err);
      } else {
        resolve(token as string);
      }
    });
  });
};

// Read as raw bytes, not text: the HMAC key is the file's exact bytes (see toSigningKey).
async function loadPrivateKey(): Promise<Buffer> {
  try {
    return Buffer.from(await Bun.file(`${baseDir}/token.key`).bytes());
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

interface IDecodedToken {
  access_token: string;
  refresh_token: string;
  expires: number;
}

export interface ITokenRespose {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
