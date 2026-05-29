import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../accept-login/route";
import { mockFetchByUrl, mockRequest } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("accept-login", () => {
  const body = {
    login_challenge: "lc_123",
    subject: "kratos-id-1",
    id_token: { name: "Ada", email: "ada@example.com" },
  };

  it("returns redirect_to on success", async () => {
    mockFetchByUrl([{ match: "/login/accept", result: { ok: true, json: { redirect_to: "https://app/cb" } } }]);
    const res = await POST(mockRequest(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ redirect_to: "https://app/cb" });
  });

  it("sends remember, acr aal1 and context.id_token to Hydra", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/login/accept", result: { ok: true, json: { redirect_to: "x" } } },
    ]);
    await POST(mockRequest(body));
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent).toMatchObject({
      subject: "kratos-id-1",
      remember: true,
      acr: "aal1",
      context: { id_token: body.id_token },
    });
  });

  it("returns 500 with the Hydra error text on non-OK", async () => {
    mockFetchByUrl([{ match: "/login/accept", result: { ok: false, status: 500, text: "boom" } }]);
    const res = await POST(mockRequest(body));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Hydra error") });
  });

  it("surfaces a fetch failure as a 500 JSON error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const res = await POST(mockRequest(body));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "network down" });
  });
});
