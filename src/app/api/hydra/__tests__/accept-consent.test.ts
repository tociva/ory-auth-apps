import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../accept-consent/route";
import { mockFetchByUrl, mockRequest } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const consentRequest = {
  subject: "kratos-id-1",
  requested_scope: ["openid", "email"],
  requested_access_token_audience: ["app-a"],
};
const identity = { traits: { name: "Ada", email: "ada@example.com", picture: "p.png" } };

function happyPath() {
  return mockFetchByUrl([
    // GET consent request (no /accept in the URL)
    { match: "/requests/consent?", result: { ok: true, json: consentRequest } },
    // GET Kratos identity
    { match: "/identities/", result: { ok: true, json: identity } },
    // PUT accept
    { match: "/consent/accept", result: { ok: true, json: { redirect_to: "https://app/cb" } } },
  ]);
}

describe("accept-consent", () => {
  it("returns redirect_to on success", async () => {
    happyPath();
    const res = await POST(mockRequest({ consent_challenge: "cc_1" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ redirect_to: "https://app/cb" });
  });

  it("(regression) grants exactly the requested_scope, not a hardcoded list", async () => {
    const fetchMock = happyPath();
    await POST(mockRequest({ consent_challenge: "cc_1" }));
    const acceptCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/consent/accept"))!;
    const sent = JSON.parse((acceptCall[1] as RequestInit).body as string);
    expect(sent.grant_scope).toEqual(["openid", "email"]);
    expect(sent.grant_scope).not.toContain("offline_access");
  });

  it("(regression) grants exactly the requested_access_token_audience", async () => {
    const fetchMock = happyPath();
    await POST(mockRequest({ consent_challenge: "cc_1" }));
    const acceptCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/consent/accept"))!;
    const sent = JSON.parse((acceptCall[1] as RequestInit).body as string);
    expect(sent.grant_access_token_audience).toEqual(["app-a"]);
  });

  it("maps Kratos traits into id_token and access_token", async () => {
    const fetchMock = happyPath();
    await POST(mockRequest({ consent_challenge: "cc_1" }));
    const acceptCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/consent/accept"))!;
    const sent = JSON.parse((acceptCall[1] as RequestInit).body as string);
    const expected = { name: "Ada", email: "ada@example.com", picture: "p.png" };
    expect(sent.session.id_token.user).toEqual(expected);
    expect(sent.session.access_token.user).toEqual(expected);
  });

  it("returns 400 when consent_challenge is missing", async () => {
    happyPath();
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 when the consent request lookup fails", async () => {
    mockFetchByUrl([{ match: "/requests/consent?", result: { ok: false, status: 500, text: "nope" } }]);
    const res = await POST(mockRequest({ consent_challenge: "cc_1" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the Kratos identity lookup fails", async () => {
    mockFetchByUrl([
      { match: "/requests/consent?", result: { ok: true, json: consentRequest } },
      { match: "/identities/", result: { ok: false, status: 404, json: { error: "not found" } } },
    ]);
    const res = await POST(mockRequest({ consent_challenge: "cc_1" }));
    expect(res.status).toBe(500);
  });
});
