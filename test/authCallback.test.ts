import { afterAll, describe, expect, test } from "bun:test";
import express from "express";
import { get, type Server } from "http";
import type { AddressInfo } from "net";
import { AuthRouter, type AuthDeps } from "../src/web/routers/Auth.router";
import { parseTokenResponse, type ITokenRespose } from "../src/web/services/authorisation.service";

const tokenResponse: ITokenRespose = {
  access_token: "a",
  token_type: "Bearer",
  expires_in: 604800,
  refresh_token: "r",
  scope: "identify",
};

const serve = (deps: AuthDeps) => {
  const app = express();
  app.use("/auth", new AuthRouter(deps).router);
  return new Promise<{ server: Server; base: string }>((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, base: `http://localhost:${(server.address() as AddressInfo).port}` });
    });
  });
};

interface Reply {
  status: number;
  location?: string;
  setCookie?: string[];
}

// Plain http.get: test/setup.ts disables the global fetch. Times out rather than hanging.
const request = (url: string) =>
  new Promise<Reply>((resolve, reject) => {
    const req = get(url, { timeout: 2000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode!, location: res.headers.location, setCookie: res.headers["set-cookie"] });
    });
    req.on("timeout", () => req.destroy(new Error("callback did not respond")));
    req.on("error", reject);
  });

const callback = (base: string, code = "bogus") => request(`${base}/auth/callback?code=${code}`);

describe("GET /auth/callback", () => {
  const servers: Server[] = [];
  const start = async (deps: AuthDeps) => {
    const { server, base } = await serve(deps);
    servers.push(server);
    return base;
  };
  afterAll(() => servers.forEach((s) => s.close()));

  test("answers with an error instead of hanging when the token exchange fails", async () => {
    const base = await start({
      fetchUserToken: () => Promise.reject(new Error("invalid_grant")),
      encodeToken: () => Promise.resolve("never"),
    });
    const res = await callback(base);
    expect(res.status).toBe(502);
    expect(res.setCookie).toBeUndefined();
  });

  test("answers with an error when signing the session fails (e.g. token.key missing)", async () => {
    const base = await start({
      fetchUserToken: () => Promise.resolve(tokenResponse),
      encodeToken: () => Promise.reject(new Error("Could not read token.key, make sure it exists.")),
    });
    const res = await callback(base);
    expect(res.status).toBe(502);
    expect(res.setCookie).toBeUndefined();
  });

  test("sets the session cookie and redirects to /bot on success", async () => {
    const base = await start({
      fetchUserToken: () => Promise.resolve(tokenResponse),
      encodeToken: () => Promise.resolve("signed.jwt.value"),
    });
    const res = await callback(base);
    expect(res.status).toBe(302);
    expect(res.location).toBe("/bot");
    expect(res.setCookie?.[0]).toContain("token=signed.jwt.value");
  });

  test("rejects a missing code", async () => {
    const base = await start({
      fetchUserToken: () => Promise.resolve(tokenResponse),
      encodeToken: () => Promise.resolve("x"),
    });
    const res = await request(`${base}/auth/callback`);
    expect(res.status).toBe(400);
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
