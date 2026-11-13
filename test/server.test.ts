import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Client } from "discord.js";
import { request, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import Server, { HOME_REDIRECT_URL } from "../src/web/Server";

let http: HttpServer;
let base: string;
beforeAll(async () => {
  // The routes never touch the Discord client unless /serverinfo is requested.
  const server = new Server({} as Client);
  await new Promise<void>((resolve) => {
    http = server.handler.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});
afterAll(() => http.close());

/** Plain http (the test preload disables fetch); never follows redirects. */
const send = (method: string, path: string) =>
  new Promise<{ status: number; location: string | undefined }>((resolve, reject) => {
    request(`${base}${path}`, { method }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, location: res.headers.location }));
    })
      .on("error", reject)
      .end();
  });

describe("GET /", () => {
  test("redirects to the community site with a temporary redirect", async () => {
    expect(HOME_REDIRECT_URL).toBe("https://smash-nederland.nl");
    expect(await send("GET", "/")).toEqual({ status: 302, location: HOME_REDIRECT_URL });
  });

  test("ignores the query string", async () => {
    expect(await send("GET", "/?utm_source=x")).toEqual({ status: 302, location: HOME_REDIRECT_URL });
  });

  test("HEAD redirects too", async () => {
    expect(await send("HEAD", "/")).toEqual({ status: 302, location: HOME_REDIRECT_URL });
  });

  test("the old home page's files are no longer served", async () => {
    for (const path of ["/index.html", "/style.css", "/favicon.png", "/sitemap.xml", "/img/PGK_New_512.png"]) {
      expect((await send("GET", path)).status).toBe(404);
    }
  });

  test("only the root redirects", async () => {
    expect((await send("POST", "/")).status).toBe(404);
    expect((await send("GET", "/nope")).status).toBe(404);
  });
});
