import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptLogout } from "../handlers/accept-logout";
import { mockFetchByUrl } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe("accept-logout", () => {
  it("returns redirect_to on a valid logout_challenge", async () => {
    mockFetchByUrl([
      { match: "/logout/accept", result: { ok: true, json: { redirect_to: "https://app/loggedout" } } },
    ]);
    const res = await acceptLogout({ logout_challenge: "lo_1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ redirect_to: "https://app/loggedout" });
  });

  it("returns 400 when logout_challenge is missing", async () => {
    mockFetchByUrl([]);
    const res = await acceptLogout({});
    expect(res.status).toBe(400);
  });

  it("returns 500 on Hydra error", async () => {
    mockFetchByUrl([
      { match: "/logout/accept", result: { ok: false, status: 500, text: "boom" } },
    ]);
    const res = await acceptLogout({ logout_challenge: "lo_1" });
    expect(res.status).toBe(500);
  });

  it("returns 500 on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const res = await acceptLogout({ logout_challenge: "lo_1" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "network down" });
  });
});
