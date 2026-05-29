/** Framework-agnostic handler result so handlers can be unit-tested without Express. */
export interface HandlerResult {
  status: number;
  body: unknown;
}

export function errorBody(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "An unknown error occurred" };
}

/** Read an admin response body as JSON, falling back to text then statusText. */
export async function readError(res: Response): Promise<string> {
  return res
    .clone()
    .json()
    .then((j) => (typeof j === "string" ? j : JSON.stringify(j)))
    .catch(() => res.text().catch(() => res.statusText));
}
