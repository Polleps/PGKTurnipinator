import { afterAll, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "http";
import { ActionRouter, type ActionDeps } from "../src/web/routers/Action.router";
import type { IDecodedToken } from "../src/web/services/authorisation.service";
import type { IUserInfo } from "../src/web/discord.agent";
import { SESSION_COOKIE } from "../src/web/session";
import { cookieLine, cookieValue, listen, request } from "./http";

const user: IUserInfo = { id: "42", username: "organiser", discriminator: "0", global_name: "Organiser", flags: 0 };
const fresh = (extra: Partial<IDecodedToken> = {}): IDecodedToken => ({
  access_token: "access",
  refresh_token: "refresh",
  expires: Date.now() + 60_000,
  remember: true,
  ...extra,
});

/** Session cookies are fake: the cookie value is the session as JSON (verification is mocked). */
const sessionCookie = (session: IDecodedToken | Record<string, unknown>) =>
  `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}`;

const servers: Server[] = [];
afterAll(() => servers.forEach((s) => s.close()));

const start = async (overrides: Partial<ActionDeps> = {}) => {
  const calls: string[] = [];
  const deps: ActionDeps = {
    verifyActionRequest: (token) => {
      try {
        return Promise.resolve(JSON.parse(token) as IDecodedToken);
      } catch {
        return Promise.reject(new Error("bad token"));
      }
    },
    refreshUserToken: (refresh) => {
      calls.push(`refresh:${refresh}`);
      return Promise.resolve({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "identify",
      });
    },
    encodeToken: (data, remember) =>
      Promise.resolve(
        JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token, expires: Date.now() + 3600_000, remember }),
      ),
    encodeSession: (session) => Promise.resolve(JSON.stringify(session)),
    getUserInfo: () => Promise.resolve(user),
    runAction: (userInfo, action) => {
      calls.push(`run:${userInfo.id}:${action.name}`);
      return Promise.resolve("Tournament Posted");
    },
    fetchTournamentDetails: (slug) => Promise.resolve({ slug } as never),
    userCanFetchTournament: () => Promise.resolve(true),
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  app.use("/bot/api", new ActionRouter(deps).router);
  const { server, base } = await listen(app);
  servers.push(server);
  return { base: `${base}/bot/api`, calls };
};

const json = { "Content-Type": "application/json" };
const post = (url: string, cookie?: string, headers: Record<string, string> = json, body = "{}") =>
  request(url, { method: "POST", headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) }, body });

describe("GET /bot/api/me", () => {
  test("401 without a session cookie", async () => {
    const { base } = await start();
    const res = await request(`${base}/me`);
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body).message).toContain("log in");
  });

  test("401 and clears a cookie that doesn't verify", async () => {
    const { base } = await start();
    const res = await request(`${base}/me`, { headers: { Cookie: `${SESSION_COOKIE}=garbage` } });
    expect(res.status).toBe(401);
    expect(cookieValue(res, SESSION_COOKIE)).toBe("");
  });

  test("401 when Discord doesn't know the access token any more", async () => {
    const { base } = await start({ getUserInfo: () => Promise.resolve({ message: "401: Unauthorized" } as never) });
    const res = await request(`${base}/me`, { headers: { Cookie: sessionCookie(fresh()) } });
    expect(res.status).toBe(401);
  });

  test("returns the user for a valid session, without touching the cookie", async () => {
    const { base } = await start();
    const res = await request(`${base}/me`, { headers: { Cookie: sessionCookie(fresh()) } });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: "42", username: "organiser", global_name: "Organiser" });
    expect(res.setCookie).toEqual([]);
  });

  test("refreshes an expired Discord token and keeps the cookie's persistence", async () => {
    const { base, calls } = await start();
    const res = await request(`${base}/me`, {
      headers: { Cookie: sessionCookie(fresh({ expires: Date.now() - 1, remember: true })) },
    });
    expect(res.status).toBe(200);
    expect(calls).toEqual(["refresh:refresh"]);
    expect(JSON.parse(decodeURIComponent(cookieValue(res, SESSION_COOKIE)!))).toMatchObject({
      access_token: "new-access",
      remember: true,
    });
    const line = cookieLine(res, SESSION_COOKIE)!;
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Max-Age=31536000");
  });

  test("a failed refresh logs out", async () => {
    const { base } = await start({ refreshUserToken: () => Promise.reject(new Error("invalid_grant")) });
    const res = await request(`${base}/me`, { headers: { Cookie: sessionCookie(fresh({ expires: 0 })) } });
    expect(res.status).toBe(401);
    expect(cookieValue(res, SESSION_COOKIE)).toBe("");
  });

  test("re-issues a cookie from before httpOnly as an httpOnly session cookie", async () => {
    const { base } = await start();
    const legacy = { access_token: "access", refresh_token: "refresh", expires: Date.now() + 60_000 };
    const res = await request(`${base}/me`, { headers: { Cookie: sessionCookie(legacy) } });
    expect(res.status).toBe(200);
    expect(JSON.parse(decodeURIComponent(cookieValue(res, SESSION_COOKIE)!))).toEqual({ ...legacy, remember: false });
    const line = cookieLine(res, SESSION_COOKIE)!;
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Path=/bot/");
    expect(line).not.toContain("Max-Age");
  });

  test("an async failure answers 500 instead of hanging", async () => {
    const { base } = await start({ encodeSession: () => Promise.reject(new Error("token.key missing")) });
    const legacy = { access_token: "access", refresh_token: "refresh", expires: Date.now() + 60_000 };
    const res = await request(`${base}/me`, { headers: { Cookie: sessionCookie(legacy) } });
    expect(res.status).toBe(500);
  });
});

describe("POST /bot/api/actions/run", () => {
  const body = JSON.stringify({ action: { name: "posttournament", args: [] } });

  test("401 without a session cookie", async () => {
    const { base, calls } = await start();
    const res = await post(`${base}/actions/run`, undefined, json, body);
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
  });

  test("a token in the body is no longer accepted", async () => {
    const { base } = await start();
    const res = await post(`${base}/actions/run`, undefined, json, JSON.stringify({ token: JSON.stringify(fresh()) }));
    expect(res.status).toBe(401);
  });

  test("runs the action for the logged-in user", async () => {
    const { base, calls } = await start();
    const res = await post(`${base}/actions/run`, sessionCookie(fresh()), json, body);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: "Tournament Posted" });
    expect(calls).toEqual(["run:42:posttournament"]);
  });

  test.each([
    ["a form post (urlencoded)", { "Content-Type": "application/x-www-form-urlencoded" }],
    ["a text/plain post", { "Content-Type": "text/plain" }],
    ["a post without content type", {}],
    ["a cross-site JSON post", { ...json, "Sec-Fetch-Site": "cross-site" }],
    ["a same-site (other subdomain) JSON post", { ...json, "Sec-Fetch-Site": "same-site" }],
  ])("CSRF: rejects %s", async (_name, headers: Record<string, string>) => {
    const { base, calls } = await start();
    const res = await post(`${base}/actions/run`, sessionCookie(fresh()), headers, body);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  test("CSRF: accepts a same-origin JSON post", async () => {
    const { base } = await start();
    const res = await post(`${base}/actions/run`, sessionCookie(fresh()), {
      "Content-Type": "application/json; charset=utf-8",
      "Sec-Fetch-Site": "same-origin",
    }, body);
    expect(res.status).toBe(200);
  });
});

describe("POST /bot/api/actions/tournamentdetails/:slug", () => {
  test("needs a session", async () => {
    const { base } = await start();
    expect((await post(`${base}/actions/tournamentdetails/cup`)).status).toBe(401);
  });

  test("returns the details", async () => {
    const { base } = await start();
    const res = await post(`${base}/actions/tournamentdetails/cup`, sessionCookie(fresh()));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: "success", data: { slug: "cup" } });
  });
});

describe("POST /bot/api/logout", () => {
  test("clears the session cookie", async () => {
    const { base } = await start();
    const res = await post(`${base}/logout`, sessionCookie(fresh()));
    expect(res.status).toBe(204);
    expect(cookieValue(res, SESSION_COOKIE)).toBe("");
    expect(cookieLine(res, SESSION_COOKIE)).toContain("Path=/bot/");
    expect(cookieLine(res, SESSION_COOKIE)).toContain("Expires=Thu, 01 Jan 1970");
  });

  test("CSRF: a cross-site logout is rejected", async () => {
    const { base } = await start();
    const res = await post(`${base}/logout`, sessionCookie(fresh()), { "Content-Type": "text/plain" });
    expect(res.status).toBe(403);
    expect(res.setCookie).toEqual([]);
  });
});
