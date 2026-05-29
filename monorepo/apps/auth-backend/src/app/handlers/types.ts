/** Framework-agnostic handler result so handlers can be unit-tested without Express. */
export interface HandlerResult {
  status: number;
  body: unknown;
}

export function errorBody(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "An unknown error occurred" };
}
