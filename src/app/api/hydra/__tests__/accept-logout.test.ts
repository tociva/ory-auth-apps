import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../accept-logout/route";
import { mockFetchByUrl, mockRequest } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("accept-logout", () => {
  it("returns 400 when logout_challenge is missing", async () => {
    const res = await POST(mockRequest({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("logout_challenge") });
  });

  it("returns redirect_to on success", async () => {
    mockFetchByUrl([{ match: "/logout/accept", result: { ok: true, json: { redirect_to: "https://app/bye" } } }]);
    const res = await POST(mockRequest({ logout_challenge: "lo_1" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ redirect_to: "https://app/bye" });
  });

  it("returns 500 on Hydra error", async () => {
    mockFetchByUrl([{ match: "/logout/accept", result: { ok: false, status: 500, text: "boom" } }]);
    const res = await POST(mockRequest({ logout_challenge: "lo_1" }));
    expect(res.status).toBe(500);
  });

  it("surfaces a fetch failure as a 500 JSON error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const res = await POST(mockRequest({ logout_challenge: "lo_1" }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "network down" });
  });
});
