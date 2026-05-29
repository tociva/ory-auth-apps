import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptLogin } from "../handlers/accept-login";
import { mockFetchByUrl } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("accept-login", () => {
  it("returns redirect_to on a valid login_challenge + subject", async () => {
    mockFetchByUrl([
      { match: "/login/accept", result: { ok: true, json: { redirect_to: "https://app/cb" } } },
    ]);
    const res = await acceptLogin({ login_challenge: "lc_1", subject: "kratos-id-1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirect_to: "https://app/cb" });
  });

  it("sends remember, acr: aal1, and context.id_token in the PUT body", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/login/accept", result: { ok: true, json: { redirect_to: "https://app/cb" } } },
    ]);
    const idToken = { name: "Ada", email: "ada@example.com" };
    await acceptLogin({ login_challenge: "lc_1", subject: "kratos-id-1", id_token: idToken });
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/login/accept"))!;
    const sent = JSON.parse((call[1] as RequestInit).body as string);
    expect(sent.remember).toBe(true);
    expect(sent.acr).toBe("aal1");
    expect(sent.context.id_token).toEqual(idToken);
  });

  it("returns 500 with the Hydra error text when Hydra responds non-OK", async () => {
    mockFetchByUrl([
      { match: "/login/accept", result: { ok: false, status: 500, text: "boom" } },
    ]);
    const res = await acceptLogin({ login_challenge: "lc_1", subject: "s" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Hydra error: boom" });
  });

  it("returns 400 when login_challenge is missing", async () => {
    mockFetchByUrl([]);
    const res = await acceptLogin({ subject: "s" });
    expect(res.status).toBe(400);
  });

  it("surfaces network/fetch failure as a JSON error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const res = await acceptLogin({ login_challenge: "lc_1", subject: "s" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "network down" });
  });
});
