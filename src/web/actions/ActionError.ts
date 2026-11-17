/** A problem with the request itself. The action route answers it with 400 and the message, which the form shows. */
export class ActionError extends Error {
  public readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/** How the action route answers a failed action. Other errors keep the old 200 + `error: true`. */
export const actionErrorResponse = (e: unknown): { status: number; body: { error: true; message: string } } => ({
  status: e instanceof ActionError ? e.status : 200,
  body: { error: true, message: e instanceof Error ? e.message : String(e) },
});
