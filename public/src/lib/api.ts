import type { StartGGDetails } from "./formModel";

/** A server answer turned into what the form shows. */
export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string };

interface ServerBody {
  error?: boolean;
  message?: unknown;
  data?: unknown;
}

const messageOf = (body: ServerBody | undefined, status: number): string =>
  typeof body?.message === "string" && body.message !== "" ? body.message : `The server answered with HTTP ${status}.`;

/** The form's API (src/web/routers/Action.router.ts); the session cookie is sent automatically. */
const API = "/bot/api";

/**
 * `/actions/run`. A 400 carries a message meant for the user (e.g. "load the details from
 * start.gg first"), and a 401 says the login is gone; both are shown as-is. Other failures,
 * including the old 200 + `error: true`, are shown as "Server Error: ...".
 */
export const parsePostResponse = (status: number, body: ServerBody | undefined): ApiResult<string> => {
  if (status === 400 || status === 401) {
    return { ok: false, message: messageOf(body, status) };
  }
  if (status < 200 || status >= 300 || body === undefined || body.error) {
    return { ok: false, message: `Server Error: ${messageOf(body, status)}` };
  }
  return { ok: true, value: typeof body.message === "string" ? body.message : "" };
};

/** `/actions/tournamentdetails/:slug`: `{ message: "success", data }`, or an error message. */
export const parseDetailsResponse = (status: number, body: ServerBody | undefined): ApiResult<StartGGDetails> => {
  if (
    status < 200 ||
    status >= 300 ||
    body === undefined ||
    body.error ||
    typeof body.data !== "object" ||
    !body.data
  ) {
    return { ok: false, message: messageOf(body, status) };
  }
  return { ok: true, value: body.data as StartGGDetails };
};

// JSON is required by the server's CSRF guard for every POST.
const postJSON = async (url: string, payload: unknown): Promise<{ status: number; body: ServerBody | undefined }> => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => undefined)) as ServerBody | undefined;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: true, message: "Could not reach the server. Check your connection." } };
  }
};

export const fetchTournamentDetails = async (slug: string): Promise<ApiResult<StartGGDetails>> => {
  if (slug.trim() === "") {
    return { ok: false, message: "Enter a slug" };
  }
  const { status, body } = await postJSON(`${API}/actions/tournamentdetails/${encodeURIComponent(slug)}`, {});
  return parseDetailsResponse(status, body);
};

export const postAction = async (action: { name: string; args: string[] }): Promise<ApiResult<string>> => {
  const { status, body } = await postJSON(`${API}/actions/run`, { action });
  return parsePostResponse(status, body);
};

/** The logged-in Discord user, from `GET /me`. */
export interface Me {
  id: string;
  username: string;
  global_name: string | null;
}

/**
 * `GET /me`: the user when logged in, `null` when not (401), or an error message when the
 * server can't be asked (so a hiccup doesn't look like being logged out).
 */
export const parseMeResponse = (status: number, body: unknown): ApiResult<Me | null> => {
  if (status === 401) {
    return { ok: true, value: null };
  }
  const me = body as Partial<Me> | undefined;
  if (status !== 200 || typeof me?.id !== "string" || typeof me.username !== "string") {
    return { ok: false, message: messageOf(body as ServerBody | undefined, status) };
  }
  return { ok: true, value: { id: me.id, username: me.username, global_name: me.global_name ?? null } };
};

export const fetchMe = async (): Promise<ApiResult<Me | null>> => {
  try {
    const res = await fetch(`${API}/me`, { credentials: "same-origin" });
    return parseMeResponse(res.status, await res.json().catch(() => undefined));
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
};

/** Clears the httpOnly session cookie (page JS can't). */
export const logout = async (): Promise<void> => {
  await postJSON(`${API}/logout`, {});
};
