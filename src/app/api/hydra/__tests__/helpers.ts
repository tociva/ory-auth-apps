import { vi } from "vitest";
import type { NextRequest } from "next/server";

/** Build a minimal NextRequest-like object exposing the bits the handlers use. */
export function mockRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

type FetchResult = {
  ok: boolean;
  status?: number;
  /** JSON body returned by res.json() */
  json?: unknown;
  /** Text body returned by res.text() */
  text?: string;
};

/**
 * Route global fetch calls by URL substring. Each matcher returns a fake
 * Response. Falls back to a 500 if no matcher matches, surfacing test gaps.
 */
export function mockFetchByUrl(matchers: Array<{ match: string; result: FetchResult }>) {
  const fn = vi.fn(async (url: string | URL) => {
    const u = String(url);
    const hit = matchers.find((m) => u.includes(m.match));
    const r: FetchResult = hit?.result ?? { ok: false, status: 500, json: { error: "unmatched" } };
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json,
      text: async () => r.text ?? JSON.stringify(r.json ?? ""),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
