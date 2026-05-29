import { afterEach, describe, expect, it, vi } from "vitest";
import { rejectConsent } from "../handlers/reject-consent";
import { mockFetchByUrl } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("reject-consent", () => {
  it("sends error: access_denied and returns redirect_to", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/consent/reject", result: { ok: true, json: { redirect_to: "https://app/denied" } } },
    ]);
    const res = await rejectConsent({ consent_challenge: "cc_1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirect_to: "https://app/denied" });
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/consent/reject"))!;
    const sent = JSON.parse((call[1] as RequestInit).body as string);
    expect(sent.error).toBe("access_denied");
  });

  it("returns 500 on Hydra error", async () => {
    mockFetchByUrl([
      { match: "/consent/reject", result: { ok: false, status: 500, json: { error: "boom" } } },
    ]);
    const res = await rejectConsent({ consent_challenge: "cc_1" });
    expect(res.status).toBe(500);
  });
});
