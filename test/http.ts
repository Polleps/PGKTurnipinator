import type { Express } from "express";
import { request as httpRequest, type Server } from "http";
import type { AddressInfo } from "net";

/** Starts `app` on a random port; returns its base URL and the server (close it afterwards). */
export const listen = (app: Express) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, base: `http://localhost:${(server.address() as AddressInfo).port}` });
    });
  });

export interface Reply {
  status: number;
  location?: string;
  setCookie: string[];
  body: string;
}

/** Plain node:http (test/setup.ts disables the global fetch). Times out rather than hanging. */
export const request = (
  url: string,
  { method = "GET", headers = {}, body }: { method?: string; headers?: Record<string, string>; body?: string } = {},
) =>
  new Promise<Reply>((resolve, reject) => {
    const req = httpRequest(url, { method, headers, timeout: 2000 }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode!,
          location: res.headers.location,
          setCookie: res.headers["set-cookie"] ?? [],
          body: data,
        }),
      );
    });
    req.on("timeout", () => req.destroy(new Error("the server did not respond")));
    req.on("error", reject);
    req.end(body);
  });

/** The Set-Cookie line for cookie `name`, or undefined. */
export const cookieLine = (reply: Reply, name: string) => reply.setCookie.find((c) => c.startsWith(`${name}=`));

/** The value set for cookie `name` ("" when it is being cleared). */
export const cookieValue = (reply: Reply, name: string) =>
  cookieLine(reply, name)
    ?.split(";")[0]
    .slice(name.length + 1);
