import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../reject-consent/route";
import { mockFetchByUrl, mockRequest } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("reject-consent", () => {
  it("sends access_denied and returns redirect_to", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/consent/reject", result: { ok: true, json: { redirect_to: "https://app/denied" } } },
    ]);
    const res = await POST(mockRequest({ consent_challenge: "cc_1" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ redirect_to: "https://app/denied" });
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.error).toBe("access_denied");
  });

  it("returns 500 on Hydra error", async () => {
    mockFetchByUrl([{ match: "/consent/reject", result: { ok: false, status: 500, json: { error: "x" } } }]);
    const res = await POST(mockRequest({ consent_challenge: "cc_1" }));
    expect(res.status).toBe(500);
  });
});
