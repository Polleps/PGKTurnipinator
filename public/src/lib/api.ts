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

/**
 * `/actions/run`. A 400 carries a message meant for the user (e.g. "load the details from
 * start.gg first", or "Could not authenticate."), shown as-is. Other failures, including
 * the old 200 + `error: true`, are shown as "Server Error: ...".
 */
export const parsePostResponse = (status: number, body: ServerBody | undefined): ApiResult<string> => {
  if (status === 400) {
    return { ok: false, message: messageOf(body, status) };
  }
  if (status < 200 || status >= 300 || body === undefined || body.error) {
    return { ok: false, message: `Server Error: ${messageOf(body, status)}` };
  }
  return { ok: true, value: typeof body.message === "string" ? body.message : "" };
};

/** `/actions/tournamentdetails/:slug`: `{ message: "success", data }`, or an error message. */
export const parseDetailsResponse = (status: number, body: ServerBody | undefined): ApiResult<StartGGDetails> => {
  if (status < 200 || status >= 300 || body === undefined || body.error || typeof body.data !== "object" || !body.data) {
    return { ok: false, message: messageOf(body, status) };
  }
  return { ok: true, value: body.data as StartGGDetails };
};

const postJSON = async (url: string, payload: unknown): Promise<{ status: number; body: ServerBody | undefined }> => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => undefined)) as ServerBody | undefined;
    return { status: res.status, body };
  } catch {
    return { status: 0, body: { error: true, message: "Could not reach the server. Check your connection." } };
  }
};

export const fetchTournamentDetails = async (slug: string, token: string): Promise<ApiResult<StartGGDetails>> => {
  if (slug.trim() === "") {
    return { ok: false, message: "Enter a slug" };
  }
  const { status, body } = await postJSON(`/actions/tournamentdetails/${encodeURIComponent(slug)}`, { token });
  return parseDetailsResponse(status, body);
};

export const postAction = async (action: { name: string; args: string[] }, token: string): Promise<ApiResult<string>> => {
  const { status, body } = await postJSON("/actions/run", { action, token });
  return parsePostResponse(status, body);
};
