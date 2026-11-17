import { afterAll, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "http";
import { AuthRouter, type AuthDeps } from "../src/web/routers/Auth.router";
import { parseTokenResponse, type ITokenRespose } from "../src/web/services/authorisation.service";
import { isSecureOrigin, safeEqual, SESSION_COOKIE, STATE_COOKIE } from "../src/web/session";
import { cookieLine, cookieValue, listen, request } from "./http";

const tokenResponse: ITokenRespose = {
  access_token: "a",
  token_type: "Bearer",
  expires_in: 604800,
  refresh_token: "r",
  scope: "identify",
};

const AUTHORIZE = "https://discord.com/oauth2/authorize?client_id=1&response_type=code&scope=identify";

const servers: Server[] = [];
afterAll(() => servers.forEach((s) => s.close()));

const start = async (overrides: Partial<AuthDeps> = {}) => {
  const deps: AuthDeps = {
    fetchUserToken: () => Promise.resolve(tokenResponse),
    encodeToken: (_data, remember) => Promise.resolve(`signed.jwt.${remember ? "remember" : "session"}`),
    authorizeURL: AUTHORIZE,
    ...overrides,
  };
  const app = express();
  app.use("/auth", new AuthRouter(deps).router);
  const { server, base } = await listen(app);
  servers.push(server);
  return base;
};

/** Starts a login like a browser would: returns the state Discord gets and the cookie to send back. */
const login = async (base: string, query = "") => {
  const res = await request(`${base}/auth/login${query}`);
  const state = new URL(res.location!).searchParams.get("state")!;
  return { res, state, cookie: `${STATE_COOKIE}=${cookieValue(res, STATE_COOKIE)}` };
};

const callback = (base: string, query: string, cookie?: string) =>
  request(`${base}/auth/callback?${query}`, { headers: cookie ? { Cookie: cookie } : {} });

describe("GET /auth/login", () => {
  test("redirects to Discord with a random state, kept in a short-lived httpOnly cookie", async () => {
    const base = await start();
    const { res, state } = await login(base);
    expect(res.status).toBe(302);
    const url = new URL(res.location!);
    expect(`${url.origin}${url.pathname}`).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("1");
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const line = cookieLine(res, STATE_COOKIE)!;
    expect(cookieValue(res, STATE_COOKIE)).toBe(`${state}.0`);
    expect(line).toContain("Path=/auth/callback");
    expect(line).toContain("Max-Age=600");
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");

    const again = await login(base);
    expect(again.state).not.toBe(state);
  });

  test("remembers the remember-me choice in the state cookie", async () => {
    const base = await start();
    const { res, state } = await login(base, "?remember=1");
    expect(cookieValue(res, STATE_COOKIE)).toBe(`${state}.1`);
  });

  test("answers 500 when OAUTH2_URI is not a URL", async () => {
    const base = await start({ authorizeURL: undefined as unknown as string });
    const res = await request(`${base}/auth/login`);
    expect(res.status).toBe(500);
    expect(res.setCookie).toEqual([]);
  });
});

describe("GET /auth/callback", () => {
  test("sets an httpOnly session cookie and redirects to the form on success", async () => {
    const base = await start();
    const { state, cookie } = await login(base);
    const res = await callback(base, `code=c&state=${state}`, cookie);
    expect(res.status).toBe(302);
    expect(res.location).toBe("/bot/");
    expect(cookieValue(res, SESSION_COOKIE)).toBe("signed.jwt.session");
    const line = cookieLine(res, SESSION_COOKIE)!;
    expect(line).toContain("Path=/bot/");
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    // Not remembered: a session cookie, gone when the browser closes.
    expect(line).not.toContain("Max-Age");
    expect(line).not.toContain("Expires");
    // The state is single-use.
    expect(cookieValue(res, STATE_COOKIE)).toBe("");
  });

  test("remember me gives a one-year cookie", async () => {
    const base = await start();
    const { state, cookie } = await login(base, "?remember=1");
    const res = await callback(base, `code=c&state=${state}`, cookie);
    expect(cookieValue(res, SESSION_COOKIE)).toBe("signed.jwt.remember");
    expect(cookieLine(res, SESSION_COOKIE)).toContain("Max-Age=31536000");
  });

  test.each([
    ["without a state cookie", (state: string) => `code=c&state=${state}`, false],
    ["without a state parameter", () => "code=c", true],
    ["with a different state", () => "code=c&state=someone-elses-state", true],
    ["with an empty state", () => "code=c&state=", true],
  ])("rejects a callback %s", async (_name, query, sendCookie) => {
    let exchanged = false;
    const base = await start({
      fetchUserToken: () => {
        exchanged = true;
        return Promise.resolve(tokenResponse);
      },
    });
    const { state, cookie } = await login(base);
    const res = await callback(base, query(state), sendCookie ? cookie : undefined);
    expect(res.status).toBe(400);
    expect(res.body).toContain("log in again");
    expect(cookieLine(res, SESSION_COOKIE)).toBeUndefined();
    expect(exchanged).toBe(false);
  });

  test("a state cookie can't be replayed after it was cleared", async () => {
    const base = await start();
    const { state, cookie } = await login(base);
    const first = await callback(base, `code=c&state=${state}`, cookie);
    expect(first.status).toBe(302);
    // The browser drops the cleared cookie; a second callback with the same state has none.
    const second = await callback(base, `code=c&state=${state}`);
    expect(second.status).toBe(400);
  });

  test("sends a cancelled login back to the form", async () => {
    const base = await start();
    const { state, cookie } = await login(base);
    const res = await callback(base, `error=access_denied&state=${state}`, cookie);
    expect(res.status).toBe(302);
    expect(res.location).toBe("/bot/");
    expect(cookieLine(res, SESSION_COOKIE)).toBeUndefined();
  });

  test("rejects a missing code", async () => {
    const base = await start();
    const { state, cookie } = await login(base);
    const res = await callback(base, `state=${state}`, cookie);
    expect(res.status).toBe(400);
  });

  test("answers with an error instead of hanging when the token exchange fails", async () => {
    const base = await start({ fetchUserToken: () => Promise.reject(new Error("invalid_grant")) });
    const { state, cookie } = await login(base);
    const res = await callback(base, `code=bogus&state=${state}`, cookie);
    expect(res.status).toBe(502);
    expect(cookieLine(res, SESSION_COOKIE)).toBeUndefined();
  });

  test("answers with an error when signing the session fails (e.g. token.key missing)", async () => {
    const base = await start({
      encodeToken: () => Promise.reject(new Error("Could not read token.key, make sure it exists.")),
    });
    const { state, cookie } = await login(base);
    const res = await callback(base, `code=c&state=${state}`, cookie);
    expect(res.status).toBe(502);
    expect(cookieLine(res, SESSION_COOKIE)).toBeUndefined();
  });
});

describe("cookie helpers", () => {
  test("cookies are Secure when the site is served over https", () => {
    expect(isSecureOrigin("https://bot.example.org/auth/callback")).toBe(true);
    expect(isSecureOrigin("http://localhost:3001/auth/callback")).toBe(false);
    expect(isSecureOrigin(undefined)).toBe(false);
  });

  test("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("parseTokenResponse", () => {
  test("returns a successful token response", () => {
    expect(parseTokenResponse(200, tokenResponse)).toEqual(tokenResponse);
  });

  test("throws Discord's error for a rejected code", () => {
    expect(() =>
      parseTokenResponse(400, { error: "invalid_grant", error_description: 'Invalid "code" in request.' }),
    ).toThrow(/HTTP 400\): invalid_grant/);
  });

  test("throws when a 200 carries no access_token", () => {
    expect(() => parseTokenResponse(200, {})).toThrow(/no access_token/);
  });
});
