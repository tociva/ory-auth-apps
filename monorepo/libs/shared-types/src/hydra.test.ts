import { describe, expect, it } from "vitest";
import {
  isHydraConsentRequest,
  isHydraRedirectResponse,
  type HydraConsentRequest,
} from "./hydra";

const consentRequest: HydraConsentRequest = {
  challenge: "cc_1",
  client: { client_id: "app-a" },
  requested_scope: ["openid", "email"],
  requested_access_token_audience: ["app-a"],
  skip: false,
  subject: "kratos-id-1",
};

describe("isHydraConsentRequest", () => {
  it("accepts a valid consent request", () => {
    expect(isHydraConsentRequest(consentRequest)).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isHydraConsentRequest(null)).toBe(false);
    expect(isHydraConsentRequest({})).toBe(false);
    expect(isHydraConsentRequest({ ...consentRequest, subject: 1 })).toBe(false);
    expect(
      isHydraConsentRequest({ ...consentRequest, requested_scope: "openid" }),
    ).toBe(false);
    expect(
      isHydraConsentRequest({ ...consentRequest, requested_scope: [1, 2] }),
    ).toBe(false);
    expect(
      isHydraConsentRequest({ ...consentRequest, requested_access_token_audience: undefined }),
    ).toBe(false);
  });

  it("round-trips a parsed sample payload", () => {
    const parsed = JSON.parse(JSON.stringify(consentRequest));
    expect(isHydraConsentRequest(parsed)).toBe(true);
  });
});

describe("isHydraRedirectResponse", () => {
  it("accepts a redirect response", () => {
    expect(isHydraRedirectResponse({ redirect_to: "https://app/cb" })).toBe(true);
  });

  it("rejects payloads without redirect_to", () => {
    expect(isHydraRedirectResponse({})).toBe(false);
    expect(isHydraRedirectResponse({ redirect_to: 1 })).toBe(false);
    expect(isHydraRedirectResponse(null)).toBe(false);
  });
});
